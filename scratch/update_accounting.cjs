const fs = require('fs');
let content = fs.readFileSync('src/components/accounting/AccountingApp.tsx', 'utf-8');

// Replace colors
content = content.replace('color="var(--success)"', 'color="#ef4444"'); // TrendingUp
content = content.replace('color="var(--danger)"', 'color="#10b981"'); // TrendingDown
content = content.replace('color: r.type === \'income\' ? \'var(--success)\' : \'var(--text-primary)\'', 'color: r.type === \'income\' ? \'#ef4444\' : \'#10b981\'');
content = content.replace('color: \'var(--success)\', fontSize: \'1.5rem\'', 'color: \'#ef4444\', fontSize: \'1.5rem\''); // totalIncome
content = content.replace('color: \'var(--danger)\', fontSize: \'1.5rem\'', 'color: \'#10b981\', fontSize: \'1.5rem\''); // totalExpense
content = content.replace('totalIncome - totalExpense >= 0 ? \'var(--success)\' : \'var(--danger)\'', 'totalIncome - totalExpense >= 0 ? \'#ef4444\' : \'#10b981\''); // balance

// Extract list box
const listStartStr = '        {/* Lists */}';
const listEndStr = '      </div>\n\n      {/* Right Column: Stats */}';

const listStart = content.indexOf(listStartStr);
const listEnd = content.indexOf(listEndStr);

if (listStart !== -1 && listEnd !== -1) {
  const listBlock = content.substring(listStart, listEnd);
  
  // Remove list block from its original place
  content = content.substring(0, listStart) + content.substring(listEnd);
  
  // Insert it after the chart block
  const chartEndStr = '              </RePieChart>\n            </ResponsiveContainer>\n          ) : (\n             <div style={{ height: \'100%\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\' }}>尚無資料</div>\n          )}\n        </div>';
  
  const chartEndIdx = content.indexOf(chartEndStr);
  if (chartEndIdx !== -1) {
    const insertIdx = chartEndIdx + chartEndStr.length;
    content = content.substring(0, insertIdx) + '\n\n' + listBlock + content.substring(insertIdx);
  }
}

fs.writeFileSync('src/components/accounting/AccountingApp.tsx', content, 'utf-8');
