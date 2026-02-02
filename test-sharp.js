const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function testSave() {
    try {
        const dir = path.join(process.cwd(), 'photosu');
        if (!fs.existsSync(dir)) {
            console.log('Creating directory:', dir);
            fs.mkdirSync(dir, { recursive: true });
        }

        // 1x1 pixel red dot base64
        const base64Data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const buffer = Buffer.from(matches[2], 'base64');

        const filePath = path.join(dir, 'test-image.jpg');
        console.log('Writing to:', filePath);

        await sharp(buffer).jpeg().toFile(filePath);
        console.log('Success! Image saved.');
    } catch (err) {
        console.error('Error:', err);
    }
}

testSave();
