#!/bin/bash

# ==========================================
# Script Penyedot Komponen React Bits
# ==========================================

# Setup Variabel
PROJECT_DIR="./src/components/ui"
REPO_URL="https://github.com/davidhdev/react-bits.git"
TEMP_DIR="/tmp/react-bits-tumbal"

# Pilih stack lu: ts-tailwind, tailwind, ts-default, atau content
STACK="ts-tailwind"

echo "[*] Memulai operasi penyedotan komponen ReactBits..."

# 1. Pastikan folder tujuan ada di project lokal lu
mkdir -p $PROJECT_DIR

# 2. Bersihin folder temp kalau misal sebelumnya ada sisaan
rm -rf $TEMP_DIR

# 3. Clone repo secara shallow (cuma ngambil commit terakhir biar ringan dan cepet)
echo "[*] Mengeksekusi shallow clone dari GitHub..."
git clone --depth 1 $REPO_URL $TEMP_DIR

# 4. Rampok isi foldernya secara rekursif
echo "[*] Memindahkan semua komponen dari folder $STACK ke $PROJECT_DIR..."
cp -r $TEMP_DIR/src/$STACK/* $PROJECT_DIR/

# 5. Hapus jejak
echo "[*] Menghapus folder tumbal..."
rm -rf $TEMP_DIR

echo "[✔] Eksekusi selesai, Bos! Semua komponen udah masuk gudang lokal lu."
