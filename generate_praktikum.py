#!/usr/bin/env python3
import zipfile, os

OUT = '/home/zennz/Videos/Tools_PRD/Praktikum_KWTI_VibeCoderz.docx'

CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

WORD_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr>
    <w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="360" w:after="120"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>
</w:styles>'''

def p(text, bold=False, style=None, center=False):
    s = f'<w:pStyle w:val="{style}"/>' if style else ''
    jc = '<w:jc w:val="center"/>' if center else ''
    ppr = f'<w:pPr>{s}{jc}</w:pPr>' if (s or jc) else ''
    b = '<w:b/>' if bold else ''
    return f'<w:p>{ppr}<w:r><w:rPr>{b}</w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'

def esc(t):
    return t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def h1(text): return p(text, bold=True, style='Heading1', center=True)
def h2(text): return p(text, bold=True, style='Heading2')
def pagebreak(): return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def table(headers, rows):
    xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>'
    for b in ['top','left','bottom','right','insideH','insideV']:
        xml += f'<w:{b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
    xml += '</w:tblBorders></w:tblPr>'
    xml += '<w:tr>'
    for h in headers:
        xml += f'<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{esc(h)}</w:t></w:r></w:p></w:tc>'
    xml += '</w:tr>'
    for row in rows:
        xml += '<w:tr>'
        for cell in row:
            xml += f'<w:tc><w:p><w:r><w:t xml:space="preserve">{esc(str(cell))}</w:t></w:r></w:p></w:tc>'
        xml += '</w:tr>'
    xml += '</w:tbl>'
    return xml

def flowchart_box(text, is_decision=False, is_end=False):
    fill = "D9EAD3" if is_end else ("FFF2CC" if is_decision else "CFE2F3")
    return f'''
    <w:p><w:jc w:val="center"/></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="4000" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="12" w:space="0" w:color="3D85C6"/>
          <w:left w:val="single" w:sz="12" w:space="0" w:color="3D85C6"/>
          <w:bottom w:val="single" w:sz="12" w:space="0" w:color="3D85C6"/>
          <w:right w:val="single" w:sz="12" w:space="0" w:color="3D85C6"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{fill}"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="40"/><w:color w:val="666666"/></w:rPr><w:t>↓</w:t></w:r>
    </w:p>
    '''

body = ''
body += p('LAPORAN PRAKTIKUM', bold=True, style='Heading1', center=True)
body += p('KEWIRAUSAHAAN TEKNOLOGI INFORMASI', bold=True, center=True)
body += p('')
body += p('Tema: Simulasi Pendirian dan Pengembangan Badan Usaha Digital', center=True)
body += p('')
body += p('Proyek: VibeCoderz', bold=True, center=True)
body += p('Platform AI-Powered Software Development', center=True)
body += pagebreak()

body += h1('PRAKTIKUM 1 - Analisis Kesiapan Usaha')
body += p('Tujuan: Menilai apakah usaha VibeCoderz layak naik level dari MVP menjadi badan usaha formal.', bold=True)
body += h2('Checklist Kesiapan Usaha')
body += table(
    ['No', 'Pertanyaan', 'Status', 'Keterangan'],
    [
        ['1', 'Apakah sudah ada pelanggan aktif?', 'YA', 'VibeCoderz memiliki 2 user terdaftar aktif yang menggunakan platform untuk membuat PRD dan generate kode website.'],
        ['2', 'Apakah sudah ada transaksi berulang?', 'BELUM', 'Sistem subscription tersedia (Free/Pro Rp20rb/Pro Max Rp75rb), namun kedua user masih di tier Free.'],
        ['3', 'Apakah sudah ada revenue minimal?', 'BELUM', 'Revenue Rp0. Modal Rp0 (bootstrapped). Operasional menggunakan API gratis.'],
        ['4', 'Apakah produk sudah stabil?', 'YA', 'Fitur inti (Build PRD, Build Code streaming AI, dashboard) sudah stabil dan berjalan.'],
        ['5', 'Apakah sudah ada tim/role?', 'YA', 'Founder tunggal sebagai Full-Stack Developer sekaligus AI Engineer.'],
    ]
)
body += p('')
body += p('Startup Readiness Score: 5/10', bold=True)
body += p('Keputusan: REVISI MODEL - Produk stabil namun belum ada revenue dan basis pelanggan masih 2 user. Perlu fokus akuisisi user dan validasi willingness to pay sebelum formalisasi badan usaha.', bold=True)
body += pagebreak()

body += h1('PRAKTIKUM 2 - Simulasi Bentuk Badan Usaha')
body += p('Tujuan: Memilih bentuk usaha paling realistis untuk VibeCoderz.', bold=True)
body += h2('Perbandingan Bentuk Badan Usaha')
body += table(
    ['Bentuk Usaha', 'Keunggulan', 'Risiko Hukum dan Finansial', 'Kesiapan Scaling'],
    [
        ['Usaha Perorangan', 'Mudah, murah, pajak sederhana, cocok tahap awal', 'Tanggung jawab tidak terbatas, sulit cari investor', 'Rendah'],
        ['Kemitraan / CV', 'Modal gabungan, pembagian peran jelas', 'Sekutu aktif tanggung jawab tidak terbatas', 'Sedang'],
        ['Perseroan Terbatas (PT)', 'Tanggung jawab terbatas, bisa terima investasi', 'Biaya pendirian tinggi Rp3-7jt, regulasi ketat', 'Tinggi'],
        ['Waralaba Digital', 'Scaling cepat, brand sudah dikenal', 'Butuh standarisasi ketat, biaya franchise', 'Sangat Tinggi'],
    ]
)
body += p('')
body += p('Keputusan: Usaha Perorangan (tahap awal), migrasi ke PT saat revenue stabil.', bold=True)
body += p('Alasan pemilihan:', bold=True)
body += p('- Dengan modal Rp0 dan 2 user, pendirian PT belum realistis (biaya notaris Rp3-7 juta).')
body += p('- Usaha perorangan memungkinkan fokus pengembangan produk tanpa beban administratif.')
body += p('- Setelah revenue Rp5jt/bulan dan 50+ user, migrasi ke PT untuk menerima investasi.')
body += pagebreak()

body += h1('PRAKTIKUM 3 - Simulasi Legalitas Usaha')
body += p('Tujuan: Memahami alur legal pendirian usaha VibeCoderz.', bold=True)
body += h2('A. Simulasi OSS (Online Single Submission)')
body += p('Alur pendaftaran melalui sistem OSS RBA:')
body += p('- Langkah 1: Akses oss.go.id, registrasi akun pelaku usaha')
body += p('- Langkah 2: Input data identitas pendiri (KTP, NPWP, email)')
body += p('- Langkah 3: Pilih jenis usaha perorangan')
body += p('- Langkah 4: Input data usaha (nama, alamat, modal)')
body += p('- Langkah 5: Pilih KBLI dan klasifikasi risiko')
body += p('- Langkah 6: NIB terbit otomatis')

body += h2('B. Draft Data Usaha')
body += table(
    ['Komponen', 'Detail'],
    [
        ['Nama Usaha', 'VibeCoderz'],
        ['Bidang Usaha', 'Platform Pengembangan Perangkat Lunak Berbasis AI (SaaS)'],
        ['Kode KBLI', '62019 - Aktivitas Pemrograman Komputer Lainnya'],
        ['Alamat', 'Domisili founder (home-based business)'],
        ['Modal Dasar', 'Rp0 (bootstrapped, tanpa modal eksternal)'],
        ['Struktur', 'Founder tunggal (sole proprietorship)'],
        ['Klasifikasi Risiko', 'Rendah (usaha digital, tidak memerlukan izin khusus)'],
    ]
)

body += h2('C. Flowchart Proses Perizinan')
body += flowchart_box('1. REGISTRASI AKUN OSS (oss.go.id)')
body += flowchart_box('2. INPUT DATA IDENTITAS (KTP, NPWP, Email)')
body += flowchart_box('3. PILIH JENIS USAHA (Perorangan)')
body += flowchart_box('4. INPUT DATA USAHA (VibeCoderz, KBLI 62019)')
body += flowchart_box('5. KLASIFIKASI RISIKO (Rendah)', is_decision=True)
body += flowchart_box('6. NIB TERBIT OTOMATIS')
body += flowchart_box('7. DAFTAR NPWP PRIBADI')
body += flowchart_box('8. BUKA REKENING BANK BISNIS')
body += flowchart_box('9. OPERASIONAL RESMI VIBECODERZ', is_end=True)
# Remove the last arrow
body = body[:-160] + '</w:p>'

body += pagebreak()

body += h1('PRAKTIKUM 4 - Studi Waralaba (Franchise Thinking)')
body += p('Tujuan: Memahami model scaling cepat melalui waralaba.', bold=True)
body += h2('A. Analisis Jenis Waralaba')
body += p('1. Franchise Digital (Contoh: SaaS White-Label)', bold=True)
body += p('- Model: Product Franchise (partner mendapat lisensi menjual platform dengan brand mereka)')
body += p('- Contoh: Platform website builder yang di-white-label oleh agency')
body += p('- Biaya awal: Rp5-50 juta (lisensi tahunan). Revenue sharing: 20-30%')
body += h2('B. Apakah VibeCoderz bisa difranchise-kan?')
body += p('BELUM SAAT INI, namun potensial di masa depan. Yang harus disiapkan:', bold=True)
body += p('- Basis user minimal 100+ aktif')
body += p('- API endpoint dan dokumentasi teknis')
body += p('- Dashboard mitra dengan branding kustom (white-label)')
body += p('- SLA untuk uptime dan support')
body += pagebreak()

body += h1('PRAKTIKUM 5 - Analisis Keuntungan vs Risiko Waralaba')
body += p('Tujuan: Berpikir kritis sebagai franchise owner vs franchisee.', bold=True)
body += h2('A. Keuntungan vs Kelemahan Membeli Franchise')
body += table(
    ['Keuntungan', 'Kelemahan'],
    [
        ['Brand sudah dikenal (tidak bangun awareness dari nol)', 'Biaya awal tinggi (fee + royalti kurangi margin)'],
        ['Sistem terbukti jalan (SOP, tools)', 'Tidak bebas inovasi (terikat SOP pusat)'],
        ['Risiko lebih rendah (kegagalan 5-10% vs startup 90%)', 'Ketergantungan (jika pusat kolaps, cabang ikut)'],
    ]
)
body += h2('B. Simulasi Keputusan')
body += p('Keputusan: BANGUN SENDIRI', bold=True)
body += p('Justifikasi:')
body += p('- VibeCoderz memiliki teknologi proprietary (AI code gen) sebagai competitive moat.')
body += p('- Modal Rp0 menunjukkan kemampuan bootstrapping, tidak perlu biaya franchise.')
body += p('- Revenue model subscription lebih menguntungkan jangka panjang daripada franchise fee.')
body += pagebreak()

body += h1('PRAKTIKUM 6 - Model Pengembangan Usaha')
body += p('Tujuan: Mengubah VibeCoderz dari UMKM digital menjadi bisnis yang bisa tumbuh.', bold=True)
body += h2('Roadmap VibeCoderz (2026-2029)')
body += table(
    ['Level', 'Strategi', 'Metrik Target'],
    [
        ['1: MVP (sekarang)', 'Build PRD + Build Code. Google OAuth. 3 tier sub. AI streaming.', '2 user. Revenue Rp0.'],
        ['2: Repeat Customer', 'Promosi ke komunitas developer. Content marketing. Referral.', '50+ user. MRR Rp200rb-1jt.'],
        ['3: Sistem dan SOP', 'SOP support. Automated billing. CI/CD. Knowledge base.', '500+ user. MRR Rp5-10jt.'],
        ['4: Legal Entity', 'Pendirian PT. Rekening bisnis. NPWP badan.', 'PT terdaftar. NIB aktif.'],
        ['5: Scaling', 'White-Label SaaS Partnership. API marketplace. Seed funding.', '5000+ user. ARR Rp500+jt.'],
    ]
)
body += h2('Jalur Scaling: White-Label SaaS + API Ecosystem')
body += p('Justifikasi:', bold=True)
body += p('- White-Label: Agency bisa jual VibeCoderz dengan brand mereka.')
body += p('- API Ecosystem: Developer integrasikan AI code gen ke tools mereka.')

doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>'''

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('[Content_Types].xml', CONTENT_TYPES)
    zf.writestr('_rels/.rels', RELS)
    zf.writestr('word/_rels/document.xml.rels', WORD_RELS)
    zf.writestr('word/document.xml', doc_xml)
    zf.writestr('word/styles.xml', STYLES)

print(f'OK: {OUT} ({os.path.getsize(OUT)} bytes)')
