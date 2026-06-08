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
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr>
    <w:pPr><w:spacing w:after="160" w:line="320" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="360" w:after="160"/><w:jc w:val="left"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/><w:color w:val="1D4ED8"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="28"/><w:color w:val="334155"/></w:rPr>
  </w:style>
</w:styles>'''

def p(text, bold=False, style=None, center=False, color=None, italic=False, size=None):
    s = f'<w:pStyle w:val="{style}"/>' if style else ''
    jc = '<w:jc w:val="center"/>' if center else ''
    ppr = f'<w:pPr>{s}{jc}</w:pPr>' if (s or jc) else ''
    b = '<w:b/>' if bold else ''
    i = '<w:i/>' if italic else ''
    c = f'<w:color w:val="{color}"/>' if color else ''
    sz = f'<w:sz w:val="{size}"/>' if size else ''
    rpr = f'<w:rPr>{b}{i}{c}{sz}</w:rPr>' if (b or i or c or sz) else ''
    return f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r></w:p>'

def esc(t):
    return t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def h1(text): return p(text, bold=True, style='Heading1')
def h2(text): return p(text, bold=True, style='Heading2')
def pagebreak(): return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

def bullet(text):
    return f'''<w:p><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:r><w:t xml:space="preserve">• {esc(text)}</w:t></w:r></w:p>'''

def table(headers, rows):
    xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>'
    for b in ['top','left','bottom','right','insideH','insideV']:
        xml += f'<w:{b} w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>'
    xml += '</w:tblBorders></w:tblPr>'
    xml += '<w:tr>'
    for h in headers:
        xml += f'<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">{esc(h)}</w:t></w:r></w:p></w:tc>'
    xml += '</w:tr>'
    for row in rows:
        xml += '<w:tr>'
        for cell in row:
            xml += f'<w:tc><w:tcPr><w:vAlign w:val="top"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">{esc(str(cell))}</w:t></w:r></w:p></w:tc>'
        xml += '</w:tr>'
    xml += '</w:tbl><w:p/>'
    return xml

def flow_box(text, step_no, border_color="3B82F6", fill="F8FAFC", text_color="1E40AF"):
    return f'''
    <w:p><w:jc w:val="center"/></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="16" w:space="0" w:color="{border_color}"/>
          <w:left w:val="single" w:sz="16" w:space="0" w:color="{border_color}"/>
          <w:bottom w:val="single" w:sz="16" w:space="0" w:color="{border_color}"/>
          <w:right w:val="single" w:sz="16" w:space="0" w:color="{border_color}"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{fill}"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="{text_color}"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">{esc(step_no + ". " + text)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="48"/><w:color w:val="94A3B8"/></w:rPr><w:t>↓</w:t></w:r>
    </w:p>
    '''

body = ''
# COVER
body += p('LAPORAN PRAKTIKUM', bold=True, center=True, size="48", color="0F172A")
body += p('KEWIRAUSAHAAN TEKNOLOGI INFORMASI', bold=True, center=True, size="32", color="0F172A")
body += p('')
body += p('Tema: Simulasi Pendirian dan Pengembangan Badan Usaha Digital', center=True, size="24", color="475569")
body += p('')
body += p('Studi Kasus Proyek: VIBECODERZ', bold=True, center=True, size="28", color="2563EB")
body += p('Platform AI-Powered Software Development', center=True, size="24", color="64748B")
body += p('')
body += p('Disusun Sebagai Output Praktikum:', bold=True, center=True)
body += p('Mini Business Legality + Business Model Upgrade Pack', center=True)
body += pagebreak()

# P1
body += h1('1. PRAKTIKUM 1 – Analisis Kesiapan Usaha')
body += p('Tujuan: Menilai apakah usaha VibeCoderz layak naik level dari MVP (Minimum Viable Product) menjadi badan usaha formal, mengingat saat ini baru memiliki 2 user dan modal Rp. 0.', bold=True)
body += h2('Checklist Kesiapan Usaha (Konteks VibeCoderz)')
body += table(
    ['No', 'Pertanyaan', 'Status', 'Keterangan / Realita Bisnis'],
    [
        ['1', 'Apakah sudah ada pelanggan aktif UMKM/Digital?', 'YA (Terbatas)', 'Saat ini VibeCoderz baru memiliki 2 user terdaftar menggunakan otentikasi. Membuktikan produk bisa dipakai, tapi belum mencapai skala pasar (Product-Market Fit).'],
        ['2', 'Apakah sudah ada transaksi berulang?', 'BELUM', 'User masih menggunakan tier gratis. Belum ada user yang upgrade ke paket Pro (Rp.20.000) atau Pro Max (Rp.75.000).'],
        ['3', 'Apakah sudah ada revenue minimal?', 'BELUM', 'Revenue Rp. 0. Proyek dibangun dengan modal Rp. 0 (Bootstrapped). Infrastruktur mengandalkan free-tier.'],
        ['4', 'Apakah produk sudah stabil?', 'YA', 'Sistem AI Streaming, XML Artifacts, dan multi-model (Groq/DeepSeek) sudah berjalan stabil. MVP siap jual.'],
        ['5', 'Apakah sudah ada tim/role?', 'YA', 'Sistem dikelola oleh Solo Founder yang menangani Full-Stack dan Prompt Engineering.'],
    ]
)
body += p('Startup Readiness Score: 4/10', bold=True, color="1D4ED8")
body += p('Keputusan: REVISI MODEL (Fokus Akuisisi & Validasi).', bold=True)
body += p('VibeCoderz belum layak menjadi badan usaha formal (PT/CV) saat ini karena belum ada cashflow. Prioritas utama adalah memvalidasi willingness-to-pay (mendapat 10 pelanggan berbayar pertama) sebelum mengurus legalitas.')
body += pagebreak()

# P2
body += h1('2. PRAKTIKUM 2 – Simulasi Bentuk Badan Usaha')
body += p('Tujuan: Memilih bentuk usaha paling realistis sesuai kondisi modal Rp. 0 dan 2 user.', bold=True)
body += h2('Perbandingan Bentuk Usaha')
body += table(
    ['Bentuk Usaha', 'Analisis Kecocokan dengan VibeCoderz', 'Keputusan'],
    [
        ['1. Usaha Perorangan', 'Sangat cocok. Pendirian gratis, tidak butuh akta notaris. Sangat ideal untuk platform SaaS dengan modal Rp. 0.', 'PILIHAN UTAMA (Fase 1)'],
        ['2. Kemitraan (CV)', 'Cocok jika founder merekrut Co-Founder tanpa menggaji di awal. Biaya notaris sekitar Rp 1-2 Juta.', 'Alternatif (Fase 2)'],
        ['3. Perseroan (PT)', 'Terlalu berat. Butuh notaris Rp 3-5 Juta. Cocok jika VibeCoderz siap menerima suntikan dana VC.', 'Tidak Direkomendasikan'],
        ['4. Waralaba Digital', 'VibeCoderz adalah produk (SaaS). Model waralaba digital (White-labeling) adalah strategi penjualannya.', 'Tidak Relevan sbg Badan Hukum'],
    ]
)
body += p('Rencana Strategis:', bold=True, color="1D4ED8")
body += p('VibeCoderz beroperasi secara Usaha Perorangan terlebih dahulu. Ketika pendapatan stabil (Rp 5-10 Juta/bulan) dan butuh kerjasama B2B resmi, VibeCoderz akan di-upgrade menjadi PT Perorangan (syarat lebih mudah & murah dibanding PT Biasa).')
body += pagebreak()

# P3
body += h1('3. PRAKTIKUM 3 – Simulasi Legalitas Usaha (Flowchart)')
body += p('Tujuan: Memahami alur legal yang disesuaikan dengan ekosistem digital/SaaS VibeCoderz.', bold=True)
body += h2('A. Draft Data Usaha (VibeCoderz)')
body += bullet('Nama Usaha: VibeCoderz Digital')
body += bullet('KBLI Utama: 63122 (Portal Web dan/atau Platform Digital dengan Tujuan Komersial) - Wajib untuk SaaS.')
body += bullet('KBLI Sekunder: 62019 (Aktivitas Pemrograman Komputer Lainnya)')
body += bullet('Modal Usaha: Rp. 0 (Kategori Mikro)')
body += bullet('Tingkat Risiko: Rendah')

body += h2('B. Flowchart Proses Perizinan VibeCoderz (SaaS Platform)')
body += p('Alur pasti perizinan VibeCoderz dari nol hingga bisa beroperasi legal di Indonesia.')
body += flow_box('SIAPKAN DOKUMEN (KTP & NPWP Founder)', '1')
body += flow_box('REGISTRASI OSS RBA (oss.go.id)', '2')
body += flow_box('INPUT DATA USAHA PERORANGAN (Modal Rp0)', '3')
body += flow_box('PEMILIHAN KBLI (63122 & 62019)', '4')
body += flow_box('PENILAIAN RISIKO OLEH SISTEM (Risiko Rendah)', '5', border_color="EAB308", fill="FEFCE8", text_color="854D0E")
body += flow_box('TERBITNYA NIB (Nomor Induk Berusaha)', '6', border_color="3B82F6", fill="EFF6FF", text_color="1D4ED8")
body += flow_box('REGISTRASI PSE KOMINFO (Wajib Platform Web)', '7', border_color="EF4444", fill="FEF2F2", text_color="B91C1C")
body += flow_box('VIBECODERZ RESMI BEROPERASI (Buka Rekening)', '8', border_color="22C55E", fill="F0FDF4", text_color="166534")
# Remove trailing arrow
body = body[:-180] + '</w:p>'
body += pagebreak()

# P4
body += h1('4. PRAKTIKUM 4 – Studi Waralaba (Franchise Thinking)')
body += p('Tujuan: Memahami model scaling cepat, dan apakah VibeCoderz bisa menggunakan sistem Franchise.', bold=True)
body += h2('Analisis Perbandingan Franchise')
body += p('1. Franchise Klasik (F&B / Makanan):', bold=True)
body += p('Fokus lokasi fisik, supply chain bahan baku. 100% TIDAK RELEVAN untuk VibeCoderz.')
body += p('2. Franchise Digital (SaaS White-labeling):', bold=True)
body += p('Sistem di mana VibeCoderz memberikan lisensi software kepada pihak ke-3 (Agency/Kampus) agar mereka bisa menjual AI Code Generator VibeCoderz seolah-olah buatan mereka sendiri.')

body += h2('Standarisasi VibeCoderz untuk "Franchise Digital"')
body += bullet('Branding Engine: Fitur mengubah Logo dan Warna Tema UI Monokrom VibeCoderz.')
body += bullet('API Key Management: Partner memasukkan API Key DeepSeek/Groq mereka sendiri agar biaya AI dibebankan ke Partner.')
body += bullet('Multi-Tenant Database: Arsitektur (Supabase RLS) agar data user Partner A tidak bercampur dengan Partner B.')
body += pagebreak()

# P5
body += h1('5. PRAKTIKUM 5 – Analisis Keuntungan vs Risiko')
body += p('Tujuan: Simulasi keputusan: Jika UMKM digital, lebih baik beli franchise/SaaS lain atau bangun VibeCoderz sendiri?', bold=True)
body += h2('Perspektif "Membeli vs Membangun" AI Platform')
body += table(
    ['Keuntungan Membeli Franchise Digital', 'Kelemahan & Risiko'],
    [
        ['• Sistem AI & Prompt sudah matang\n• Tidak pusing mengatur bug server\n• Bisa langsung fokus jualan', '• Ketergantungan infrastruktur pusat (jika down, ikut mati)\n• Margin terpotong biaya lisensi\n• Tidak pegang source code']
    ]
)
body += p('Keputusan VibeCoderz: BANGUN SENDIRI (Menjadi Franchisor)', bold=True, color="1D4ED8")
body += p('Sebagai Solo Developer dengan modal Rp. 0, VibeCoderz memiliki Competitive Advantage berupa kemampuan teknis (AI Streaming, XML Parser). Alih-alih menjadi pembeli, VibeCoderz berposisi sebagai pencipta teknologi. Nilai tertinggi ada pada pemilik Source Code.')
body += pagebreak()

# P6
body += h1('6. PRAKTIKUM 6 – Model Pengembangan Usaha')
body += p('Tujuan: Mengubah VibeCoderz dari project hobi (MVP) menjadi bisnis komersial scalable.', bold=True)
body += h2('Roadmap 5 Level VibeCoderz (2026 - 2028)')
body += table(
    ['Level', 'Strategi Bisnis', 'Metrik Target'],
    [
        ['1: MVP (Saat Ini)', 'Fix bugs (Streaming DeepSeek). Akses Beta Gratis.', 'User: 2 -> 50 Gratis. Revenue: Rp. 0.'],
        ['2: Repeat Customer', 'Integrasi Payment (Midtrans). Fitur premium (Unlimited Tokens).', '10 Paying Customer. MRR: Rp. 200.000.'],
        ['3: Automation', 'Otomatisasi billing. Dokumentasi SOP. Referral Program.', '500 Active Users. MRR: Rp. 1.000.000+.'],
        ['4: Legal Entity', 'Modal dipakai daftar PT Perorangan & PSE Kominfo.', 'Legalitas Resmi. Kepercayaan B2B naik.'],
        ['5: Scaling (B2B)', 'B2B White-Label SaaS. Jual lisensi ke Kampus/Agency.', 'Kontrak B2B (3 Kampus). ARR: Rp. 50+ Jt.'],
    ]
)
body += h2('Justifikasi Jalur Scaling Level 5 (B2B White-label SaaS)')
body += p('Mengapa memilih White-Label B2B dibanding retail (B2C)? Karena jualan B2C butuh biaya marketing mahal. VibeCoderz (modal Rp. 0) lebih cocok B2B: mendekati institusi dengan ribuan mahasiswa. Sekali deal, langsung dapat ribuan user, menciptakan Growth Hack efisien.')

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

print(f'Done: {OUT}')
