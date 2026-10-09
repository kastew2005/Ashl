# Ashfall — мобильный 3D survival (PWA)

## Запуск локально
Модули ES требуют HTTP-сервера (не file://). В папке проекта:
    python3 -m http.server 8080
или `npx serve .`, затем откройте http://localhost:8080
Для проверки с телефона откройте http://IP-компьютера:8080 в одной Wi‑Fi сети.
(Service Worker и установка PWA работают на localhost и на HTTPS.)

## Деплой как PWA
Загрузите папку на любой HTTPS-хостинг (GitHub Pages, Netlify, Cloudflare Pages).
Откройте сайт на телефоне → «Добавить на главный экран». После первого запуска игра работает офлайн.
Нужен интернет при первом запуске: Three.js подгружается с CDN jsDelivr и кэшируется Service Worker'ом.

## Файлы
index.html — разметка (меню, HUD, окна) · style.css — стеклянный UI · game.js — мир, выживание, инвентарь, крафт
manifest.json, sw.js, icon.svg — PWA
