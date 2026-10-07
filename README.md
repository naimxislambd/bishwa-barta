# বিশ্ব বার্তা (Bishwa Barta)

আন্তর্জাতিক খবর বাংলায় — **সম্পূর্ণ ফ্রি, স্বয়ংক্রিয় নিউজ ওয়েবসাইট**। প্রতি ঘণ্টায় নতুন খবর নিজে নিজে সংগ্রহ করে সাইট হালনাগাদ হয়। কোনো সার্ভার খরচ নেই, কোনো ডাটাবেজ নেই।

International news in Bengali — a **100% free, auto-updating news website**. Fresh headlines are collected and the site rebuilds itself every hour. No server cost, no database.

## কীভাবে কাজ করে / How it works

1. `fetch-news.js` — BBC News বাংলা ও গুগল নিউজ বাংলার ফ্রি RSS ফিড থেকে খবর সংগ্রহ করে `data/news.json`-এ জমা রাখে (ডুপ্লিকেট বাদ দিয়ে, সর্বোচ্চ ৩০০টি)।
2. `build-site.js` — সেই ডেটা থেকে পুরো স্ট্যাটিক সাইট (`docs/` ফোল্ডারে) তৈরি করে: প্রচ্ছদ, সব খবর পাতা, প্রতিটি খবরের আলাদা পাতা।
3. `.github/workflows/update.yml` — GitHub Actions প্রতি ঘণ্টায় (23 মিনিটে) উপরের দুটো স্ক্রিপ্ট চালিয়ে সাইট হালনাগাদ করে।
4. GitHub Pages `docs/` ফোল্ডার থেকে সাইট পরিবেশন করে।

শুধু শিরোনাম ও সারসংক্ষেপ দেখানো হয়, উৎসের ক্রেডিটসহ মূল খবরের লিংক দেওয়া থাকে।

## চালু করা / Setup (৫ মিনিট)

1. GitHub-এ একটি **খালি repository** বানান, নাম দিন `bishwa-barta`।
2. এই ফোল্ডারের সব ফাইল সেই repo-তে push করুন:
   ```bash
   cd bishwa-barta
   git init && git add . && git commit -m "bishwa barta"
   git branch -M main
   git remote add origin https://github.com/<আপনার-ইউজারনেম>/bishwa-barta.git
   git push -u origin main
   ```
3. Repo-র **Settings → Pages**-এ যান: *Build and deployment → Deploy from a branch*, Branch: `main`, ফোল্ডার: `/docs` → **Save**।
4. **Actions** ট্যাবে গিয়ে workflow চালু করুন (প্রথমবার "I understand my workflows…" বাটনে ক্লিক লাগতে পারে)।
5. ব্যস! সাইট লাইভ হবে: `https://<আপনার-ইউজারনেম>.github.io/bishwa-barta/`

প্রথম আপডেট Actions-এর schedule অনুযায়ী এক ঘণ্টার মধ্যে হবে — অথবা Actions → "Update news" → **Run workflow** চাপ দিলে সাথে সাথে।

## লোকালে টেস্ট / Local test

```bash
node fetch-news.js   # খবর সংগ্রহ
node build-site.js   # সাইট তৈরি (docs/ ফোল্ডারে)
# তারপর docs/index.html ব্রাউজারে খুলুন
```

Node.js 18+ লাগবে, আর কোনো dependency নেই।

## নতুন উৎস যোগ করা / Adding a source

`fetch-news.js`-এর `SOURCES` অ্যারেতে ফিড যোগ করুন:

```js
{ name: 'উৎসের নাম', nameEn: 'Source Name', site: 'https://...', feed: 'https://.../rss' },
```

## License

কোড MIT। খবরের শিরোনাম/সারসংক্ষেপ সংশ্লিষ্ট সংবাদমাধ্যমের সম্পত্তি — সাইটে উৎসের লিংকসহ দেখানো হয়।
