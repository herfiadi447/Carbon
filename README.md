# WebGIS Tutupan Pesisir Barru–Pangkep

> **⚠ Status: Klasifikasi sementara — validasi independen belum lengkap.**
> Data ini bersifat eksploratif dan **bukan** inventaris karbon, peta kehilangan mangrove tervalidasi, maupun dasar klaim kredit karbon.

## Deskripsi

WebGIS portofolio statis yang membandingkan **klasifikasi tutupan pesisir** wilayah Barru–Pangkep, Sulawesi Selatan, tahun **2020 dan 2025** menggunakan citra Sentinel-2 L2A.

Fitur utama:
- 🗺️ Peta interaktif MapLibre GL JS — tampil di area studi yang benar
- 📅 Kontrol tahun (2020 / 2025) dengan lazy loading
- ↔️ Mode berdampingan (*side-by-side*) dan swipe
- 🔍 Popup kelas, legenda, batas studi, skala, reset view
- 📥 Unduhan PDF dan ZIP GIS
- ⚠️ Fallback gambar bila data gagal dimuat
- 📱 Responsif desktop dan seluler

---

## Status Validasi

| Item | Status |
|------|--------|
| Klasifikasi 2020 | Sementara — referensi parsial |
| Klasifikasi 2025 | Sementara — validasi independen **belum lengkap** |
| Peta perubahan | Belum tersedia |
| Estimasi karbon | Belum tersedia — menunggu validasi |

---

## Metode (Ringkas)

- **Citra:** Sentinel-2 L2A, komposit median 3 tanggal/tahun
  - 2020: 16 Sep; 11 & 26 Okt 2020
  - 2025: 5 Sep; 15 & 17 Okt 2025
- **Band:** B2, B3, B4, B8, B11 (B11 resampled 20→10 m)
- **Classifier:** Gaussian Maximum Likelihood (5 band)
- **Label awal:** Global Mangrove Watch v4.1.12 + ESA WorldCover 2020
- **Pembatasan:** Kandidat mangrove dalam 500 m dari GMW 2020+2025
- **Pembagian sampel:** Blok 500 m untuk mengurangi autokorelasi spasial

**Kelas:**

| Kode | Label | Warna |
|------|-------|-------|
| 1 | Kandidat mangrove | `#176443` |
| 2 | Vegetasi lain | `#9dc477` |
| 3 | Tambak / perairan terbuka | `#83bbd2` |
| 4 | Terbangun / tanah terbuka | `#d4a477` |

> Kelas 3 tidak memisahkan tambak dari laut/air terbuka.

---

## Sumber & Lisensi

| Sumber | Penggunaan | Lisensi |
|--------|-----------|---------|
| Copernicus Sentinel-2 L2A | Citra 2020 & 2025 | Bebas & Terbuka |
| GMW v4.1.12 (Bunting et al.) | Label awal, zona 500 m | CC BY 4.0 |
| ESA WorldCover 2020 | Referensi nonmangrove | CC BY 4.0 |
| KLHK / Kebijakan Satu Peta | Pemeriksaan parsial | Tidak diunggah (lisensi tidak dinyatakan) |
| MapLibre GL JS v4.7.1 | Library peta | BSD 3-Clause |

---

## Demo

🌐 **GitHub Pages:** [https://herfiadi447.github.io/Carbon/](https://herfiadi447.github.io/Carbon/)

---

## Cara Menjalankan Lokal

```bash
# Kloning repo
git clone https://github.com/herfiadi447/Carbon.git
cd Carbon

# Jalankan via HTTP server lokal (WAJIB — jangan buka index.html langsung dari disk)
# Python 3:
python -m http.server 8080

# Atau Node.js:
npx serve .

# Buka di browser:
# http://localhost:8080
```

> **Catatan:** Karena GeoJSON besar (~20–22 MB per file), load pertama memerlukan beberapa detik tergantung kecepatan jaringan atau disk lokal.

---

## Struktur Folder

```
Carbon/
├── index.html              # Halaman utama WebGIS
├── css/
│   └── style.css           # Stylesheet
├── js/
│   └── map.js              # Logic peta MapLibre GL JS
├── data/
│   ├── batas_studi.geojson # Batas wilayah studi (1 poligon)
│   ├── klasifikasi_2020.geojson  # 23.587 poligon kelas 2020 (~20 MB)
│   └── klasifikasi_2025.geojson  # 26.092 poligon kelas 2025 (~22 MB)
├── media/
│   └── peta_2020_2025.png  # Gambar fallback & portofolio
├── downloads/
│   ├── peta_2020_2025.pdf  # Peta cetak A4
│   └── data_gis_shp_geotiff.zip  # SHP + GeoTIFF untuk GIS desktop
├── .github/
│   └── workflows/
│       └── pages.yml       # GitHub Pages auto-deploy
└── README.md
```

---

## Deploy GitHub Pages

Setelah push ke branch `main`:
1. Buka **Settings > Pages** di repositori GitHub
2. Pilih **Source: Deploy from a branch**
3. Branch: `main`, folder: `/ (root)`
4. Klik **Save**
5. Tunggu ~1–2 menit, URL akan muncul di Settings > Pages

Atau gunakan workflow otomatis di `.github/workflows/pages.yml` (sudah disertakan).

---

## Catatan Penting

- **Tidak ada token, kredensial, atau path lokal** dalam kode
- Data referensi pemerintah (KLHK) **tidak disertakan** karena lisensinya tidak dinyatakan secara eksplisit
- Angka luas, kehilangan/gain, karbon **tidak ada** dalam situs ini karena belum tervalidasi
- Peta berjalan tanpa basemap untuk menghindari kebutuhan API key

---

*Versi 1.0 | November 2026 | Data sementara*
