const fs = require('fs');

function convertToMonochrome(filePath) {
    let bg = fs.readFileSync(filePath, 'utf8');

    bg = bg.replace(/secondaryColor: '#0153df'/g, "secondaryColor: '#FFFFFF'");
    bg = bg.replace(/border-t-\[\#72cf93\]/g, 'border-t-white');
    bg = bg.replace(/from-\[\#0153df\]\/20 to-\[\#111111\]/g, 'from-white/10 to-[#111111]');
    bg = bg.replace(/from-\[\#0153df\] via-\[\#4db4d7\] to-\[\#72cf93\]/g, 'from-gray-400 via-white to-gray-400');
    bg = bg.replace(/from-\[\#72cf93\]\/20/g, 'from-white/10');
    bg = bg.replace(/from-\[\#0153df\]\/20/g, 'from-white/10');
    bg = bg.replace(/to-\[\#72cf93\]\/20/g, 'to-white/10');
    bg = bg.replace(/shadow-\[0_20px_50px_rgba\(1,83,223,0\.15\)\]/g, 'shadow-[0_20px_50px_rgba(255,255,255,0.05)]');

    fs.writeFileSync(filePath, bg, 'utf8');
}

const files = ['./src/components/LandingPage.tsx', './src/components/Dashboard.tsx'];
files.forEach(f => {
    if(fs.existsSync(f)) {
        convertToMonochrome(f);
    }
});
