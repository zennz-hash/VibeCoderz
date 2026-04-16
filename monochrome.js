const fs = require('fs');

function convertToMonochrome(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Backgrounds & Surfaces (Remove bluish tint)
    content = content.replace(/#070B14/g, '#000000');
    content = content.replace(/#0A0F1C/g, '#0A0A0A');
    content = content.replace(/#111827/g, '#111111');
    content = content.replace(/from-\[\#0153df\]/g, 'from-white');
    content = content.replace(/to-\[\#4db4d7\]/g, 'to-gray-400');
    content = content.replace(/to-\[\#72cf93\]/g, 'to-gray-400');
    content = content.replace(/from-blue-600/g, 'from-gray-300');
    content = content.replace(/to-blue-400/g, 'to-gray-500');
    content = content.replace(/text-blue-[456]00/g, 'text-gray-400');
    content = content.replace(/border-blue-400/g, 'border-gray-500');
    content = content.replace(/bg-blue-[456]00/g, 'bg-white');

    // The primary and secondary colors:
    // Some buttons use bg-[#0153df]. We should make them bg-white text-black
    // e.g. bg-[#0153df] text-white -> bg-white text-black
    content = content.replace(/bg-\[\#0153df\](\/10|\/20|\/30)/g, 'bg-white$1');
    content = content.replace(/bg-\[\#0153df\]/g, 'bg-white text-black'); 
    
    // Gradients for buttons
    content = content.replace(/bg-gradient-to-r from-white to-gray-400 text-white/g, 'bg-gradient-to-r from-gray-200 to-gray-500 text-black');
    content = content.replace(/bg-gradient-to-r from-\[\#0153df\] to-\[\#72cf93\] text-white/g, 'bg-white text-black');
    content = content.replace(/bg-gradient-to-br from-white to-gray-400/g, 'bg-gradient-to-br from-gray-200 to-gray-500');

    // Text colors
    content = content.replace(/text-\[\#0153df\]/g, 'text-white');
    content = content.replace(/text-\[\#4db4d7\]/g, 'text-gray-300');
    content = content.replace(/text-\[\#72cf93\]/g, 'text-gray-300');
    content = content.replace(/text-\[\#4db4d7\]/g, 'text-gray-300');

    // Border colors
    content = content.replace(/border-\[\#0153df\](\/10|\/20|\/30|\/50)?/g, 'border-white$1');
    content = content.replace(/border-\[\#72cf93\](\/10|\/20|\/30|\/50)?/g, 'border-white$1');

    // Other accent uses of #72cf93 (Mint Green)
    content = content.replace(/bg-\[\#72cf93\](\/10|\/20|\/30)/g, 'bg-white$1');
    content = content.replace(/bg-\[\#72cf93\]/g, 'bg-white text-black'); 

    // Specific text colors to fix contrast if changed to bg-white
    content = content.replace(/text-black text-black/g, 'text-black');
    content = content.replace(/text-white text-black/g, 'text-black');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

const files = ['./src/components/LandingPage.tsx', './src/components/Dashboard.tsx'];
files.forEach(f => {
    if(fs.existsSync(f)) {
        convertToMonochrome(f);
        console.log('Converted ' + f);
    }
});
