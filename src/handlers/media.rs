use crate::models::{Media, MediaInput};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use mime_guess::from_path;
use serde_json;
use sqlx::MySqlPool;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

fn save_file_to_disk(data_uri: &str, user_id: &str, media_type: &str) -> Result<String, String> {
    let media_dir = Path::new("media");
    if !media_dir.exists() {
        fs::create_dir_all(media_dir).map_err(|e| format!("Klasör oluşturulamadı: {}", e))?;
    }

    let parts: Vec<&str> = data_uri.split(',').collect();
    if parts.len() != 2 {
        return Err("Geçersiz data URI formatı".to_string());
    }

    let meta = parts[0];
    let extension = if meta.contains("image/jpeg") {
        "jpg"
    } else if meta.contains("image/png") {
        "png"
    } else if meta.contains("image/gif") {
        "gif"
    } else if meta.contains("audio/mpeg") || meta.contains("audio/mp3") {
        "mp3"
    } else if meta.contains("audio/wav") {
        "wav"
    } else if meta.contains("audio/ogg") {
        "ogg"
    } else {
        // Genel bir uzantı veya hata
        meta.split('/').last().and_then(|s| s.split(';').next()).unwrap_or("bin")
    };

    let base64_data = parts[1];
    let bytes = BASE64_STANDARD.decode(base64_data).map_err(|e| format!("Base64 çözme hatası: {}", e))?;

    let file_id = Uuid::new_v4().to_string();
    let filename = format!("{}_{}_{}.{}", user_id, media_type, file_id, extension);
    let file_path = media_dir.join(&filename);

    let mut file = File::create(&file_path).map_err(|e| format!("Dosya oluşturma hatası: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("Dosya yazma hatası: {}", e))?;

    Ok(filename)
}

pub async fn add_media(pool: Arc<MySqlPool>, body: String) -> (String, String) {
    match serde_json::from_str::<MediaInput>(&body) {
        Ok(media_input) => {
            let media_id = Uuid::new_v4().to_string();
            let original_name = media_input.original_name.clone().unwrap_or_default();

            let file_name = match save_file_to_disk(&media_input.name, &media_input.user_id, &media_input.media_type) {
                Ok(filename) => filename,
                Err(e) => return ("500 Internal Server Error".to_string(), format!("Dosya kaydedilemedi: {}", e)),
            };

            let result = sqlx::query("INSERT INTO media (id, user_id, name, media_type, original_name) VALUES (?, ?, ?, ?, ?)")
                .bind(&media_id)
                .bind(&media_input.user_id)
                .bind(&file_name)
                .bind(&media_input.media_type)
                .bind(&original_name)
                .execute(&*pool)
                .await;

            match result {
                Ok(_) => ("201 Created".to_string(), serde_json::json!({ "id": media_id, "name": file_name }).to_string()),
                Err(e) => {
                    eprintln!("Medya ekleme hatası: {}", e);
                    ("500 Internal Server Error".to_string(), "Medya veritabanına eklenemedi".to_string())
                }
            }
        }
        Err(_) => ("400 Bad Request".to_string(), "Geçersiz JSON".to_string()),
    }
}

pub async fn list_media(pool: Arc<MySqlPool>, user_id: String, media_type: String) -> (String, String) {
    match sqlx::query_as::<_, Media>("SELECT * FROM media WHERE user_id = ? AND media_type = ?")
        .bind(user_id)
        .bind(media_type)
        .fetch_all(&*pool)
        .await
    {
        Ok(medias) => {
            let body = serde_json::to_string(&medias).unwrap_or_else(|_| "[]".to_string());
            ("200 OK".to_string(), body)
        }
        Err(e) => {
            eprintln!("Medya listeleme hatası: {}", e);
            ("500 Internal Server Error".to_string(), "Medya listesi alınamadı".to_string())
        }
    }
}

pub async fn get_media(_pool: Arc<MySqlPool>, name: String) -> Result<(Vec<u8>, String), (String, String)> {
    let file_path = Path::new("media").join(&name);
    if !file_path.is_file() {
        return Err(("404 Not Found".to_string(), "Dosya bulunamadı".to_string()));
    }

    match fs::read(&file_path) {
        Ok(bytes) => {
            let mime_type = from_path(&file_path).first_or_octet_stream().to_string();
            Ok((bytes, mime_type))
        }
        Err(e) => {
            eprintln!("Dosya okuma hatası: {}", e);
            Err(("500 Internal Server Error".to_string(), "Dosya okunamadı".to_string()))
        }
    }
}

pub async fn delete_media(pool: Arc<MySqlPool>, user_id: String, media_id: String) -> (String, String) {
    let media = match sqlx::query_as::<_, Media>("SELECT id, user_id, name, media_type, original_name FROM media WHERE id = ? AND user_id = ?")
        .bind(&media_id)
        .bind(&user_id)
        .fetch_optional(&*pool)
        .await
    {
        Ok(Some(m)) => m,
        Ok(None) => return ("404 Not Found".to_string(), "Medya bulunamadı veya size ait değil".to_string()),
        Err(e) => {
            eprintln!("Medya getirme hatası (silme için): {}", e);
            return ("500 Internal Server Error".to_string(), "Veritabanı hatası".to_string());
        }
    };

    // Önce veritabanından silmeyi dene
    match sqlx::query("DELETE FROM media WHERE id = ? AND user_id = ?")
        .bind(&media_id)
        .bind(&user_id)
        .execute(&*pool)
        .await
    {
        Ok(result) if result.rows_affected() > 0 => {
            // Veritabanından başarıyla silindiyse, dosyayı sil
            let file_path = Path::new("media").join(&media.name);
            if file_path.exists() {
                if let Err(e) = fs::remove_file(&file_path) {
                    eprintln!("Dosya silinemedi (DB kaydı silindi): {} -> {}", media.name, e);
                    // Bu bir iç hata, ama kullanıcıya yine de başarı döndürürüz
                }
            }
            ("200 OK".to_string(), "Medya silindi".to_string())
        }
        Ok(_) => ("404 Not Found".to_string(), "Silinecek medya bulunamadı".to_string()),
        Err(e) => {
            eprintln!("Medya silme hatası: {}", e);
            ("500 Internal Server Error".to_string(), "Medya silinemedi".to_string())
        }
    }
}
