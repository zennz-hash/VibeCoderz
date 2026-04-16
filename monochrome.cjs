const fs = require('fs');

function convertToMonochrome(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Make backgrounds pure black or greys
    content = content.replace(/#070B14/g, '#000000');
    content = content.replace(/#0A0F1C/g, '#0A0A0A');
    content = content.replace(/#111827/g, '#111111');
    content = content.replace(/bg-gray-800/g, 'bg-gray-700'); 
    content = content.replace(/bg-gray-900/g, 'bg-black');
    content = content.replace(/border-gray-800/g, 'border-white/10');

    // Replace the primary colors (Blue #0153df & Mint #72cf93) with white/grays
    content = content.replace(/bg-\[\#0153df\]\/[0-9]+/g, 'bg-white/10');
    content = content.replace(/bg-\[\#72cf93\]\/[0-9]+/g, 'bg-white/10');
    
    // Solid background colors become white with black text
    content = content.replace(/bg-\[\#0153df\]/g, 'bg-white text-black');
    content = content.replace(/bg-\[\#72cf93\]/g, 'bg-white text-black');

    // Text colors
    content = content.replace(/text-\[\#0153df\]/g, 'text-gray-300');
    content = content.replace(/text-\[\#4db4d7\]/g, 'text-gray-300');
    content = content.replace(/text-\[\#72cf93\]/g, 'text-gray-300');
    
    // Border colors
    content = content.replace(/border-\[\#0153df\](\/[0-9]+)?/g, 'border-white/20');
    content = content.replace(/border-\[\#72cf93\](\/[0-9]+)?/g, 'border-white/20');
    content = content.replace(/border-blue-400/g, 'border-white/20');

    // Gradient modifications
    content = content.replace(/from-\[\#0153df\](\/20)? to-\[\#111827\]/g, 'from-white/10 to-[#111111]');
    content = content.replace(/bg-gradient-to-br from-\[\#0153df\] to-\[\#4db4d7\]/g, 'bg-white text-black border-white');
    content = content.replace(/bg-gradient-to-r from-\[\#0153df\] to-\[\#72cf93\]/g, 'bg-white text-black');
    content = content.replace(/from-\[\#0153df\] to-\[\#72cf93\]/g, 'from-gray-300 to-white');

    // Fill colors in SVGs or specific shapes
    content = content.replace(/fill-\[\#0153df\]/g, 'fill-white');
    content = content.replace(/fill-\[\#72cf93\]/g, 'fill-gray-300');

    // Remove text-white if we also added text-black in the same class
    content = content.replace(/text-white text-black/g, 'text-black');
    content = content.replace(/text-black text-white/g, 'text-black');

    fs.writeFileSync(filePath, content, 'utf8');
}

const files = ['./src/components/LandingPage.tsx', './src/components/Dashboard.tsx'];
files.forEach(f => {
    if(fs.existsSync(f)) {
        convertToMonochrome(f);
        console.log('Converted ' + f);
    }
});
