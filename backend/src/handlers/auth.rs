use crate::models::{LoginData, LoginResponse, RegisterData, User};
use bcrypt::{hash, verify, DEFAULT_COST};
use serde_json;
use sqlx::MySqlPool;
use std::sync::Arc;
use uuid::Uuid;

pub async fn register(pool: Arc<MySqlPool>, body: String) -> (String, String) {
    match serde_json::from_str::<RegisterData>(&body) {
        Ok(register_data) => {
            let user_id = Uuid::new_v4().to_string();
            let hashed_password = match hash(&register_data.password, DEFAULT_COST) {
                Ok(h) => h,
                Err(_) => return ("500 Internal Server Error".to_string(), "Parola şifreleme hatası".to_string()),
            };

            let result = sqlx::query("INSERT INTO users (id, username, password) VALUES (?, ?, ?)")
                .bind(&user_id)
                .bind(&register_data.username)
                .bind(&hashed_password)
                .execute(&*pool)
                .await;

            match result {
                Ok(_) => ("201 Created".to_string(), serde_json::json!({ "user_id": user_id }).to_string()),
                Err(e) => {
                    eprintln!("Kullanıcı kaydı hatası: {}", e);
                    ("500 Internal Server Error".to_string(), "Kullanıcı kaydedilemedi".to_string())
                }
            }
        }
        Err(_) => ("400 Bad Request".to_string(), "Geçersiz JSON formatı".to_string()),
    }
}

pub async fn login(pool: Arc<MySqlPool>, body: String) -> (String, String) {
    match serde_json::from_str::<LoginData>(&body) {
        Ok(login_data) => {
            let result = sqlx::query_as::<_, User>("SELECT id, username, password FROM users WHERE username = ?")
                .bind(&login_data.username)
                .fetch_one(&*pool)
                .await;

            match result {
                Ok(user) => {
                    match verify(&login_data.password, &user.password) {
                        Ok(true) => {
                            let login_response = LoginResponse {
                                user_id: user.id,
                                username: user.username,
                            };
                            match serde_json::to_string(&login_response) {
                                Ok(json_body) => ("200 OK".to_string(), json_body),
                                Err(_) => ("500 Internal Server Error".to_string(), "Yanıt oluşturulamadı".to_string()),
                            }
                        }
                        Ok(false) => ("401 Unauthorized".to_string(), "Geçersiz kimlik bilgileri".to_string()),
                        Err(_) => ("500 Internal Server Error".to_string(), "Parola doğrulama hatası".to_string()),
                    }
                }
                Err(sqlx::Error::RowNotFound) => ("404 Not Found".to_string(), "Kullanıcı bulunamadı".to_string()),
                Err(e) => {
                    eprintln!("Giriş veritabanı hatası: {}", e);
                    ("500 Internal Server Error".to_string(), "Sunucu hatası".to_string())
                }
            }
        }
        Err(_) => ("400 Bad Request".to_string(), "Geçersiz JSON formatı".to_string()),
    }
}
