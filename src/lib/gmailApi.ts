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

/**
 * Recursively extracts and decodes text/plain and text/html body parts from a Gmail payload
 */
function extractEmailBodyText(payload: any): string {
  let text = '';

  const extractFromPart = (part: any) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      if (part.body && part.body.data) {
        try {
          const binaryString = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          text += ' ' + new TextDecoder('utf-8').decode(bytes);
        } catch {
          // ignore decoding errors
        }
      }
    }
    if (part.parts) {
      for (const p of part.parts) {
        extractFromPart(p);
      }
    }
  };

  if (payload.body && payload.body.data) {
    try {
      const binaryString = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      text += ' ' + new TextDecoder('utf-8').decode(bytes);
    } catch {
      // ignore
    }
  }

  if (payload.parts) {
    for (const p of payload.parts) {
      extractFromPart(p);
    }
  }

  return text;
}

/**
 * Extracts billing amount from raw text or HTML, strictly prioritized to avoid capturing
 * dates (e.g. 115/08/09), ROC year numbers (115年), or minimum payment amounts.
 */
export function parseAmountFromText(rawText: string): number | null {
  if (!rawText) return null;

  // Clean HTML tags, styles, scripts and normalize spaces
  const clean = rawText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/\s+/g, ' ');

  // Ordered strictly from most specific / high-confidence to general
  const regexes = [
    /本期應繳總金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /本期應繳總額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /當期應繳金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /當期帳單金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /本期結帳金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /結帳總金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /本期應繳金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /本期應繳款[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /應扣款金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /帳單金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /(?<!最低)應繳總額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /(?<!最低)應繳總金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /(?<!最低)應繳金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i,
    /繳款金額[^0-9\-]*(-?[\d,]+(?:\.\d+)?)(?![\/\-年月日])/i
  ];

  for (const r of regexes) {
    const match = clean.match(r);
    if (match) {
      const amt = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(amt) && amt > 0) {
        return amt;
      }
    }
  }

  return null;
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

      const emailDate = dateHeader ? new Date(dateHeader.value) : new Date();
      let yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Parse Year and Month from subject based on bank formats
      const ceMatch = subject.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
      const rocMatch = subject.match(/(\d{2,3})\s*年\s*(\d{1,2})\s*月/);
      const ctbcMatch = subject.match(/(?:電子帳單\s*)?(\d{3})(\d{2})\b/);
      const dateSlashMatch = subject.match(/(\d{4})[\/\-](\d{1,2})/);
      const rocSlashMatch = subject.match(/(\d{2,3})[\/\-](\d{1,2})/);

      if (ceMatch) {
        yearMonth = `${ceMatch[1]}-${ceMatch[2].padStart(2, '0')}`;
      } else if (rocMatch && parseInt(rocMatch[1], 10) < 1900) {
        const y = parseInt(rocMatch[1], 10) + 1911;
        yearMonth = `${y}-${rocMatch[2].padStart(2, '0')}`;
      } else if (ctbcMatch && parseInt(ctbcMatch[1], 10) < 1900) {
        const y = parseInt(ctbcMatch[1], 10) + 1911;
        yearMonth = `${y}-${ctbcMatch[2].padStart(2, '0')}`;
      } else if (dateSlashMatch) {
        yearMonth = `${dateSlashMatch[1]}-${dateSlashMatch[2].padStart(2, '0')}`;
      } else if (rocSlashMatch && parseInt(rocSlashMatch[1], 10) < 1900) {
        const y = parseInt(rocSlashMatch[1], 10) + 1911;
        yearMonth = `${y}-${rocSlashMatch[2].padStart(2, '0')}`;
      }

      const snippet = details.snippet || '';
      const bodyText = extractEmailBodyText(details.payload);
      const combinedEmailText = `${snippet} ${bodyText}`;

      // 1. Try to extract amount directly from email text/HTML content or snippet
      const emailAmount = parseAmountFromText(combinedEmailText);
      if (emailAmount !== null && emailAmount > 0) {
        console.log(`[Gmail Debug] (${bank}) 從郵件內容抓到金額: ${emailAmount}`);
        results.push({ bank, yearMonth, amount: emailAmount, needsManualAmount: false });
        continue;
      } else {
        console.log(`[Gmail Debug] (${bank}) 郵件文字無金額匹配，嘗試解析 PDF 附件...`);
      }

      // 2. Encrypted PDF parsing
      // Recursively find PDF attachment ID because Gmail API parts can be deeply nested
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

            // Decrypt with PDF.js (中信密碼為身分證後 8 碼，其他通常為完整身分證)
            const passwords = Array.from(new Set([
              nationalId.toUpperCase(),
              nationalId.toLowerCase(),
              nationalId.replace(/[^0-9]/g, ''), // 數字 (去掉英文字母)
              nationalId.slice(-8),              // 身分證後 8 碼
              nationalId
            ]));
            let pdfDocument = null;
            let lastError = null;
            
            for (const pwd of passwords) {
              try {
                const CMAP_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`;
                const loadingTask = pdfjsLib.getDocument({ 
                  data: bytes, 
                  password: pwd,
                  cMapUrl: CMAP_URL,
                  cMapPacked: true
                });
                pdfDocument = await loadingTask.promise;
                break; // 成功解密
              } catch (err) {
                lastError = err;
              }
            }

            if (!pdfDocument) throw lastError;

            // Extract text from the first page (usually enough for total amount)
            const page = await pdfDocument.getPage(1);
            const textContent = await page.getTextContent();
            
            const fullText = textContent.items.map((item: any) => item.str).join('');
            const spacedText = textContent.items.map((item: any) => item.str.trim()).filter(Boolean).join(' ');
            console.log(`[Gmail Debug] (${bank}) PDF 解析文字內容:`, fullText.replace(/\s+/g, ''));

            let pdfAmount = parseAmountFromText(fullText) || parseAmountFromText(spacedText);

            // Fallback for PDF with missing CJK fonts (like CTBC sometimes)
            if (pdfAmount === null) {
              console.log(`[Gmail Debug] (${bank}) PDF 解析帶空白內容 (Fallback):`, spacedText);
              const fallbackRegexes = [
                /(?:11\d|20\d{2})[\/\-]\d{2}[\/\-]\d{2}\s+(-?[\d,]+(?:\.\d+)?)/
              ];
              for (const r of fallbackRegexes) {
                const match = spacedText.match(r);
                if (match) {
                  const amt = parseInt(match[1].replace(/,/g, ''), 10);
                  if (!isNaN(amt) && amt > 0) {
                    pdfAmount = amt;
                    break;
                  }
                }
              }
            }

            if (pdfAmount !== null && pdfAmount > 0) {
              console.log(`[Gmail Debug] (${bank}) PDF 成功解析金額: ${pdfAmount}`);
              results.push({ bank, yearMonth, amount: pdfAmount, needsManualAmount: false });
            } else {
              // Could open PDF but couldn't parse amount reliably
              console.log(`[Gmail Debug] (${bank}) PDF 無法自動識別金額，需手動填寫`);
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

      // Fallback if no PDF found and no amount in email text
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
