mod models;
mod handlers;

use dotenvy::dotenv;
use sqlx::mysql::MySqlPool;
use std::env;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use tokio::runtime::Runtime;

use handlers::response::Response;

fn handle_connection(mut stream: TcpStream, pool: Arc<MySqlPool>, rt: Arc<Runtime>) {
    let mut buffer = vec![0; 20 * 1024 * 1024]; // 20MB tampon
    let mut bytes_read_total = 0;
    let mut headers_parsed = false;
    let mut body_offset = 0;
    let mut content_length = 0;

    loop {
        let bytes_read = match stream.read(&mut buffer[bytes_read_total..]) {
            Ok(0) => break, // Bağlantı kapandı
            Ok(n) => n,
            Err(e) => {
                eprintln!("İstek okuma hatası: {}", e);
                return;
            }
        };
        bytes_read_total += bytes_read;

        if !headers_parsed {
            let mut headers = [httparse::EMPTY_HEADER; 64];
            let mut req = httparse::Request::new(&mut headers);

            match req.parse(&buffer[..bytes_read_total]) {
                Ok(httparse::Status::Complete(offset)) => {
                    headers_parsed = true;
                    body_offset = offset;
                    content_length = req
                        .headers
                        .iter()
                        .find(|h| h.name.eq_ignore_ascii_case("Content-Length"))
                        .and_then(|h| std::str::from_utf8(h.value).ok())
                        .and_then(|s| s.parse::<usize>().ok())
                        .unwrap_or(0);
                }
                Ok(httparse::Status::Partial) => {
                    // Başlıkların tamamı henüz gelmedi, okumaya devam et
                    continue;
                }
                Err(e) => {
                    eprintln!("Geçersiz HTTP isteği: {}", e);
                    return; // Hatalı istek, bağlantıyı sonlandır
                }
            }
        }

        // Başlıklar ayrıştırıldıysa, gövdenin tamamının gelip gelmediğini kontrol et
        if headers_parsed {
            let body_read = bytes_read_total - body_offset;
            if body_read >= content_length {
                // Gövdenin tamamı okundu, döngüden çık
                break;
            }
        }

        // Tamponun dolmasını önle
        if bytes_read_total == buffer.len() {
            eprintln!("Tampon doldu, istek çok büyük olabilir.");
            break;
        }
    }

    if !headers_parsed {
        return; // Boş veya tamamlanmamış istek
    }
    
    // Pipelining'den kaynaklanabilecek fazladan veriyi kırp
    let final_request_size = body_offset + content_length;
    if bytes_read_total > final_request_size {
        bytes_read_total = final_request_size;
    }

    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut req = httparse::Request::new(&mut headers);

    let res = match req.parse(&buffer[..bytes_read_total]) {
        Ok(httparse::Status::Complete(offset)) => {
            let method = req.method.unwrap_or("");
            let path = req.path.unwrap_or("/");
            let body_bytes = &buffer[offset..bytes_read_total];

            rt.block_on(handlers::router::handle_request(
                method,
                path,
                body_bytes,
                pool,
            ))
        }
        _ => Response::Text {
            status: "400 Bad Request".to_string(),
            body: "Geçersiz veya tamamlanmamış HTTP isteği".to_string(),
        },
    };

    let response_bytes = build_response(res);

    if stream.write_all(&response_bytes).is_err() {
        eprintln!("Yanıt yazma hatası");
    }
}

fn build_response(res: Response) -> Vec<u8> {
    let mut headers = vec![
        "Access-Control-Allow-Origin: *".to_string(),
        "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS".to_string(),
        "Access-Control-Allow-Headers: Content-Type".to_string(),
    ];

    match res {
        Response::Text { status, body } => {
            headers.push("Content-Type: application/json; charset=utf-8".to_string());
            let response_str = format!(
                "HTTP/1.1 {}\r\n{}\r\nContent-Length: {}\r\n\r\n{}",
                status,
                headers.join("\r\n"),
                body.as_bytes().len(),
                body
            );
            response_str.into_bytes()
        }
        Response::Binary { status, body, mime_type } => {
            headers.push(format!("Content-Type: {}", mime_type));
            let mut response_head = format!(
                "HTTP/1.1 {}\r\n{}\r\nContent-Length: {}\r\n\r\n",
                status,
                headers.join("\r\n"),
                body.len()
            ).into_bytes();
            response_head.extend(body);
            response_head
        }
        Response::Empty(status) => {
             let response_str = format!(
                "HTTP/1.1 {}\r\n{}\r\n\r\n",
                status,
                headers.join("\r\n")
            );
            response_str.into_bytes()
        }
    }
}

fn main() -> std::io::Result<()> {
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL ortam değişkeni ayarlanmalı");

    let rt = Arc::new(Runtime::new().unwrap());
    let pool = rt.block_on(async {
        MySqlPool::connect(&db_url)
            .await
            .expect("Veritabanı bağlantısı kurulamadı")
    });
    let pool = Arc::new(pool);

    let listener = TcpListener::bind("127.0.0.1:8080")?;
    println!("Sunucu 127.0.0.1:8080 adresinde başlatıldı");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let pool = Arc::clone(&pool);
                let rt = Arc::clone(&rt);
                std::thread::spawn(move || {
                    handle_connection(stream, pool, rt);
                });
            }
            Err(e) => {
                eprintln!("Bağlantı hatası: {}", e);
            }
        }
    }
    Ok(())
}