use crate::models::{Todo, TodoInput};
use serde_json;
use sqlx::MySqlPool;
use std::sync::Arc;
use uuid::Uuid;

pub async fn add_todo(pool: Arc<MySqlPool>, body: String) -> (String, String) {
    match serde_json::from_str::<TodoInput>(&body) {
        Ok(todo_input) => {
            let todo_id = Uuid::new_v4().to_string();
            let result = sqlx::query("INSERT INTO todos (id, user_id, content, completed) VALUES (?, ?, ?, ?)")
                .bind(&todo_id)
                .bind(&todo_input.user_id)
                .bind(&todo_input.content)
                .bind(false)
                .execute(&*pool)
                .await;

            match result {
                Ok(_) => ("201 Created".to_string(), serde_json::json!({ "id": todo_id }).to_string()),
                Err(e) => {
                    eprintln!("Todo ekleme hatası: {}", e);
                    ("500 Internal Server Error".to_string(), "Todo eklenemedi".to_string())
                }
            }
        }
        Err(_) => ("400 Bad Request".to_string(), "Geçersiz JSON".to_string()),
    }
}

pub async fn list_todos(pool: Arc<MySqlPool>, user_id: String) -> (String, String) {
    match sqlx::query_as::<_, Todo>("SELECT * FROM todos WHERE user_id = ?")
        .bind(user_id)
        .fetch_all(&*pool)
        .await
    {
        Ok(todos) => {
            let body = serde_json::to_string(&todos).unwrap_or_else(|_| "[]".to_string());
            ("200 OK".to_string(), body)
        }
        Err(e) => {
            eprintln!("Todoları listeleme hatası: {}", e);
            ("500 Internal Server Error".to_string(), "Todolar getirilemedi".to_string())
        }
    }
}

pub async fn toggle_todo(pool: Arc<MySqlPool>, user_id: String, todo_id: String) -> (String, String) {
    let todo = match sqlx::query_as::<_, Todo>("SELECT id, user_id, content, completed FROM todos WHERE id = ? AND user_id = ?")
        .bind(&todo_id)
        .bind(&user_id)
        .fetch_optional(&*pool)
        .await
    {
        Ok(Some(todo)) => todo,
        Ok(None) => return ("404 Not Found".to_string(), "Todo bulunamadı".to_string()),
        Err(e) => {
            eprintln!("Todo getirme hatası: {}", e);
            return ("500 Internal Server Error".to_string(), "Veritabanı hatası".to_string());
        }
    };

    let new_completed = !todo.completed;
    match sqlx::query("UPDATE todos SET completed = ? WHERE id = ? AND user_id = ?")
        .bind(new_completed)
        .bind(&todo_id)
        .bind(&user_id)
        .execute(&*pool)
        .await
    {
        Ok(_) => ("200 OK".to_string(), "Todo durumu değiştirildi".to_string()),
        Err(e) => {
            eprintln!("Todo güncelleme hatası: {}", e);
            ("500 Internal Server Error".to_string(), "Durum değiştirilemedi".to_string())
        }
    }
}

pub async fn delete_todo(pool: Arc<MySqlPool>, user_id: String, todo_id: String) -> (String, String) {
    match sqlx::query("DELETE FROM todos WHERE id = ? AND user_id = ?")
        .bind(&todo_id)
        .bind(&user_id)
        .execute(&*pool)
        .await
    {
        Ok(result) if result.rows_affected() > 0 => ("200 OK".to_string(), "Todo silindi".to_string()),
        Ok(_) => ("404 Not Found".to_string(), "Todo bulunamadı veya kullanıcıya ait değil".to_string()),
        Err(e) => {
            eprintln!("Todo silme hatası: {}", e);
            ("500 Internal Server Error".to_string(), "Todo silinemedi".to_string())
        }
    }
}
