import * as fs from 'fs';

const content = fs.readFileSync('src/components/DashboardMetricsV1.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('getTodayStr')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
