use std::error::Error;

pub mod types {
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize)]
    pub struct ShortenerRequest {
        pub url: String,
    }

    #[derive(Deserialize)]
    pub struct ShortenResponse {
        pub long: Option<String>,
        pub short: String,
        pub new: bool,
    }

    #[derive(Deserialize)]
    pub struct LengthenResponse {
        pub long: Option<String>,
        pub short: String,
        pub found: bool,
    }
}

use types::*;

pub async fn expand_url(short_url: &str) -> Result<String, Box<dyn Error>> {
    let shortener_url = std::env::var("SHORTENER_URL")?;

    let client = awc::Client::new();
    let expand_body = ShortenerRequest {
        url: short_url.to_owned(),
    };

    client
        .get(shortener_url + "/lengthen/")
        .query(&expand_body)?
        .send()
        .await?
        .json::<LengthenResponse>()
        .await?
        .long
        .ok_or("URL not found".into())
}

pub async fn shorten_url(shorten_req: &ShortenerRequest) -> Result<String, Box<dyn Error>> {
    let shortener_url = std::env::var("SHORTENER_URL")?;

    let client = awc::Client::new();
    let resp = client
        .post(shortener_url + "/shorten/")
        .send_json(shorten_req)
        .await?
        .json::<ShortenResponse>()
        .await?;

    Ok(resp.short)
}
