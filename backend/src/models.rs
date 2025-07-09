use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub user_id: String,
    pub username: String,
}

#[derive(Deserialize)]
pub struct RegisterData {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginData {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, FromRow)]
pub struct Todo {
    pub id: Option<String>,
    pub user_id: String,
    pub content: String,
    pub completed: bool,
}

#[derive(Deserialize)]
pub struct TodoInput {
    pub user_id: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, FromRow, Debug, Clone)]
pub struct Media {
    pub id: Option<String>,
    pub user_id: String,
    pub name: String,
    pub media_type: String,
    pub original_name: Option<String>,
}

#[derive(Deserialize)]
pub struct MediaInput {
    pub user_id: String,
    pub name: String, // data URI
    pub media_type: String,
    pub original_name: Option<String>,
}
