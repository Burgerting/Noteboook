import * as pdfjsLib from 'pdfjs-dist';

// Set up the pdf.js worker. Using CDN to avoid complex vite config for web workers.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedBill {
  bank: string;
  yearMonth: string;
  amount: number | null;
  needsManualAmount: boolean;
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function fetchWithAuth(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Gmail API Error: ${res.statusText}`);
  return res.json();
}

export async function fetchRecentCreditCardEmails(token: string, nationalId: string, targetYearMonth?: string): Promise<ParsedBill[]> {
  // We search for recent emails with relevant subjects
  let query = 'subject:(電子帳單 OR 信用卡 OR 自動扣繳)';
  
  if (targetYearMonth) {
    const [year, month] = targetYearMonth.split('-');
    let nextYear = parseInt(year, 10);
    let nextMonth = parseInt(month, 10) + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    // Search within the specific month requested
    query += ` after:${year}/${month}/01 before:${nextYear}/${String(nextMonth).padStart(2, '0')}/01`;
  } else {
    // Default to recent 45 days if no month specified
    query += ' newer_than:45d';
  }
  
  const data = await fetchWithAuth(`${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=15`, token);
  
  if (!data.messages) return [];

  const results: ParsedBill[] = [];

  for (const msg of data.messages) {
    try {
      const details = await fetchWithAuth(`${GMAIL_API}/messages/${msg.id}`, token);
      
      const subjectHeader = details.payload.headers.find((h: any) => h.name.toLowerCase() === 'subject');
      const dateHeader = details.payload.headers.find((h: any) => h.name.toLowerCase() === 'date');
      const subject = subjectHeader ? subjectHeader.value : '';
      const emailDate = dateHeader ? new Date(dateHeader.value) : new Date();
      
      const yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;
      const snippet = details.snippet || '';

      const fromHeader = details.payload.headers.find((h: any) => h.name.toLowerCase() === 'from');
      const fromName = fromHeader ? fromHeader.value : '';
      
      // Combine subject and fromName for searching bank name
      const searchStr = (subject + ' ' + fromName).toLowerCase();

      // Identify Bank
      let bank = '';
      if (searchStr.includes('中國信託') || searchStr.includes('中信')) bank = '中信';
      else if (searchStr.includes('國泰世華') || searchStr.includes('國泰')) bank = '國泰';
      else if (searchStr.includes('永豐')) bank = '永豐';
      else if (searchStr.includes('台北富邦') || searchStr.includes('富邦')) bank = '富邦';
      else if (searchStr.includes('台新')) bank = '台新';
      else if (searchStr.includes('玉山')) bank = '玉山';
      else continue; // Skip unknown banks instead of polluting the list with '其他銀行'

      // Try to extract amount directly from snippet first (often works for text-heavy emails or auto-deduction notices)
      // Matches: "帳單金額, 63,490" or "應繳總額: 1,234" or "繳款金額 5,678" or "應扣款金額 4990"
      const snippetAmountMatch = snippet.match(/(?:帳單金額|應繳總額|繳款金額|本期應繳金?額?|應扣款金額)[:,\s]*\$?(-?[\d,]+)/);
      if (snippetAmountMatch) {
        const amount = parseInt(snippetAmountMatch[1].replace(/,/g, ''), 10);
        console.log(`[Gmail Debug] (${bank}) 從預覽文字抓到金額: ${amount} | 原文: ${snippet}`);
        results.push({ bank, yearMonth, amount, needsManualAmount: false });
        continue;
      } else {
        console.log(`[Gmail Debug] (${bank}) 預覽文字無金額匹配 | 原文: ${snippet}`);
      }

      // 2. Encrypted PDF parsing
      // Recursively find PDF attachment ID because Gmail API parts can be deeply nested (e.g., multipart/mixed -> multipart/related -> pdf)
      let attachmentId = '';
      
      const findPdfAttachment = (parts: any[]) => {
        if (!parts) return;
        for (const part of parts) {
          if (part.filename && part.filename.toLowerCase().endsWith('.pdf') && part.body && part.body.attachmentId) {
            attachmentId = part.body.attachmentId;
            return; // Found it
          }
          if (part.parts) {
            findPdfAttachment(part.parts);
          }
        }
      };

      if (details.payload.parts) {
        findPdfAttachment(details.payload.parts);
      }

      if (attachmentId) {
        try {
          const attachData = await fetchWithAuth(`${GMAIL_API}/messages/${msg.id}/attachments/${attachmentId}`, token);
          if (attachData.data) {
            const base64Data = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Decrypt with PDF.js
            const loadingTask = pdfjsLib.getDocument({ data: bytes, password: nationalId });
            const pdfDocument = await loadingTask.promise;
            
            // Extract text from the first page (usually enough for total amount)
            const page = await pdfDocument.getPage(1);
            const textContent = await page.getTextContent();
            
            // Remove all spaces to handle fragmented text parsing from PDF (e.g. "應 繳 總 額")
            const fullText = textContent.items.map((item: any) => item.str).join('');
            const cleanText = fullText.replace(/\s+/g, '');
            console.log(`[Gmail Debug] (${bank}) PDF 解析文字內容:`, cleanText);

            // Try exact phrases requested by user, then fallbacks
            // Using [^\\d\\-]* to ensure we don't accidentally consume the negative sign before matching it
            const regexes = [
              /本期應繳總金額[^\d\-]*(-?[\d,]+)/, // 永豐
              /本期應繳總額[^\d\-]*(-?[\d,]+)/,   // 國泰
              /帳單金額[^\d\-]*(-?[\d,]+)/,       // 中信
              // Fallbacks for other banks:
              /(?:本期結帳金額|應繳總金額|結帳總金額)[^\d\-]*(-?[\d,]+)/,
              /(?<!最低)應繳[金]?額[^\d\-]*(-?[\d,]+)/,
              /總計[^\d\-]*(-?[\d,]+)/
            ];
            
            let amountMatch = null;
            for (const r of regexes) {
              amountMatch = cleanText.match(r);
              if (amountMatch) break;
            }

            if (amountMatch) {
              const amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
              results.push({ bank, yearMonth, amount, needsManualAmount: false });
            } else {
              // Could open PDF but couldn't parse amount reliably
              results.push({ bank, yearMonth, amount: null, needsManualAmount: true });
            }
            continue;
          }
        } catch (pdfError) {
          console.error(`Failed to parse PDF for ${bank}`, pdfError);
          // Wrong password or parsing error, fallback to manual
          results.push({ bank, yearMonth, amount: null, needsManualAmount: true });
          continue;
        }
      }

      // Fallback if no PDF found but it's a known bank bill
      results.push({ bank, yearMonth, amount: null, needsManualAmount: true });
      
    } catch (e) {
      console.error('Error processing email message', e);
    }
  }

  // Deduplicate by bank and yearMonth (keep the one with amount if multiple exist)
  const dedupedMap = new Map<string, ParsedBill>();
  for (const r of results) {
    const key = `${r.bank}-${r.yearMonth}`;
    const existing = dedupedMap.get(key);
    if (!existing || (existing.amount === null && r.amount !== null)) {
      dedupedMap.set(key, r);
    }
  }

  return Array.from(dedupedMap.values());
}
