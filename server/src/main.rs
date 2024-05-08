use actix_web::{get, http::header, web, App, HttpResponse, HttpServer, Responder};

// disk reads are slow right? :^)
const INDEX_HTML: &'static str = include_str!("frontend/index.html");
const CSS: &'static str = include_str!("frontend/style.css");
const CLIENT_SCRIPT: &'static str = include_str!("frontend/index.js");
const LOGO: &'static [u8] = include_bytes!("frontend/logo.png");
const ICON: &'static [u8] = include_bytes!("frontend/favicon.ico");

#[get("/style.css")]
async fn style() -> impl Responder {
    HttpResponse::Ok().body(CSS)
}

#[get("/index.js")]
async fn script() -> impl Responder {
    HttpResponse::Ok().body(CLIENT_SCRIPT)
}

#[get("/logo.png")]
async fn logo() -> impl Responder {
    HttpResponse::Ok()
        .content_type(header::ContentType::png())
        .body(LOGO)
}

#[get("/favicon.ico")]
async fn icon() -> impl Responder {
    HttpResponse::Ok().body(ICON)
}

#[get("/note")]
async fn index() -> impl Responder {
    HttpResponse::Ok()
        .insert_header((
            // only allow scripts/styles/images from this server (i.e. no inline/external stuff)
            header::CONTENT_SECURITY_POLICY,
            header::HeaderValue::from_static(
                "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'",
            ),
        ))
        .body(INDEX_HTML)
}

#[get("/robots.txt")]
async fn robots_txt() -> impl Responder {
    HttpResponse::Ok().body("User-agent: *\nDisallow: /")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .service(index)
            .service(script)
            .service(style)
            .service(robots_txt)
            .service(logo)
            .service(web::redirect("/", "/note"))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
