const express = require('express');
const router = express.Router();

function intelligentRewriteEmail({ draft, contactName, companyName, requirement, senderName, tone }) {
  const cName = (contactName || '').trim();
  const firstName = cName ? cName.split(' ')[0] : '';
  const salutation = cName ? `Dear ${cName},` : 'Hello,';
  const sender = senderName || 'Infocare Customer Support';
  const company = (companyName || '').trim();
  const req = (requirement || '').trim();

  if (!draft || !draft.trim()) {
    const topic = req ? `our security solutions for ${req}` : 'your recent inquiry with Infocare';
    return `${salutation}\n\nI hope this email finds you ${company ? `and your team at ${company} ` : ''}well.\n\nI am reaching out regarding ${topic}. We would be glad to assist you with the technical specifications, pricing, and project deployment details.\n\nCould we arrange a brief call or site meeting this week at your convenience?\n\nLooking forward to your thoughts.\n\nBest regards,\n${sender}\nInfocare Systems LLC`;
  }

  const raw = draft.trim();

  // Clean and transform sentences
  let sentences = raw
    .replace(/\r\n/g, '\n')
    .split(/\n+|\.\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  let transformedSentences = sentences.map(s => {
    let t = s.replace(/^[-*•\d.]+\s*/, '').trim();
    if (!t) return '';

    // Common informal to business conversions
    t = t.replace(/^hi\s+[^,]+,?\s*/i, '');
    t = t.replace(/^dear\s+[^,]+,?\s*/i, '');
    t = t.replace(/^hello,?\s*/i, '');
    t = t.replace(/\bchecking if\b/i, 'I am writing to inquire if');
    t = t.replace(/\bjust wanted to\b/i, 'I would like to');
    t = t.replace(/\bwant to know\b/i, 'would appreciate knowing');
    t = t.replace(/\bif you want to meet\b/i, 'if you might be available to connect');
    t = t.replace(/\bcan we meet\b/i, 'would you be open to scheduling a brief meeting');
    t = t.replace(/\bgive me a call\b/i, 'feel free to connect with me directly');
    t = t.replace(/\bplz\b/i, 'please');
    t = t.replace(/\basap\b/i, 'at your earliest convenience');
    t = t.replace(/\bu\b/g, 'you');
    t = t.replace(/\br\b/g, 'are');

    // Capitalize first letter
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.?!]$/.test(t)) t += '.';
    return t;
  }).filter(Boolean);

  const intro = company
    ? `I hope this email finds you and the team at ${company} well.`
    : `I hope this email finds you well.`;

  const bodyText = transformedSentences.join('\n\n');
  const closing = 'Please let me know if this aligns with your schedule or if you have any questions in the meantime.';

  return `${salutation}\n\n${intro}\n\n${bodyText}\n\n${closing}\n\nBest regards,\n${sender}\nInfocare Systems LLC`;
}

router.post('/rewrite-email', async (req, res) => {
  const {
    draft,
    contact_name,
    company_name,
    requirement,
    sender_name,
    tone = 'professional',
    instructions,
    api_key
  } = req.body;

  const anthropicKey = api_key || req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;

  if (anthropicKey) {
    try {
      const prompt = `You are Claude, an expert AI sales communication assistant for Infocare Systems LLC (UAE), specializing in IT infrastructure, access control, CCTV, and surveillance systems.
Your task is to take the user's email draft/notes and rewrite it into a polite, articulate, high-converting business email.

Recipient: ${contact_name || 'Client'} (${company_name || 'Valued Client'})
Project Context: ${requirement || 'Infocare Solutions'}
Tone: ${tone}
Sender: ${sender_name || 'Infocare Team'}
${instructions ? `Specific Instructions: ${instructions}` : ''}

User's Raw Draft:
"""
${draft || ''}
"""

Instructions:
1. Rewrite the draft into a well-crafted email ready to send.
2. Maintain all specific dates, figures, questions, or requests from the user's draft.
3. Include an appropriate greeting (e.g. "Dear ${contact_name || 'Client'},") and sign-off.
4. Output ONLY the email body. Do not include markdown code block ticks, meta commentary, or subject line headers unless requested.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content && data.content[0] ? data.content[0].text.trim() : null;
        if (text) {
          return res.json({
            success: true,
            provider: 'claude-3-5-sonnet',
            data: {
              rewritten: text
            }
          });
        }
      } else {
        const errText = await response.text();
        console.warn('[Anthropic Claude API Warning]:', response.status, errText);
      }
    } catch (err) {
      console.warn('[Anthropic Claude Request Error]:', err.message);
    }
  }

  const rewritten = intelligentRewriteEmail({
    draft,
    contactName: contact_name,
    companyName: company_name,
    requirement,
    senderName: sender_name,
    tone
  });

  return res.json({
    success: true,
    provider: anthropicKey ? 'claude-fallback' : 'claude-engine',
    data: {
      rewritten
    }
  });
});

module.exports = router;
