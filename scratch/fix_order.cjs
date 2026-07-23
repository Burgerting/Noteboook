const fs = require('fs');
let content = fs.readFileSync('src/components/accounting/AccountingApp.tsx', 'utf-8');

const listStartStr = '        {/* Lists */}';
const listEndStr = '      {/* Right Column: Stats */}';

const listStart = content.indexOf(listStartStr);
const listEnd = content.indexOf(listEndStr);

if (listStart !== -1 && listEnd !== -1) {
  // Find the exact closing tag before Right Column
  let actualEnd = content.lastIndexOf('      </div>', listEnd);
  if (actualEnd !== -1) {
    const listBlock = content.substring(listStart, actualEnd);
    
    // Remove the block
    content = content.substring(0, listStart) + content.substring(actualEnd);
    
    // Find where to insert it (after the chart-box)
    const chartEndStr = '各項支出占比</h3>'; // Unique string in chart box
    const chartEndIdx = content.indexOf(chartEndStr);
    
    if (chartEndIdx !== -1) {
      // Find the closing div of the chart box
      const chartBoxEnd = content.indexOf('        </div>', chartEndIdx) + '        </div>'.length;
      
      content = content.substring(0, chartBoxEnd) + '\n\n' + listBlock + content.substring(chartBoxEnd);
      fs.writeFileSync('src/components/accounting/AccountingApp.tsx', content, 'utf-8');
      console.log('Successfully moved list box');
    }
  }
}
