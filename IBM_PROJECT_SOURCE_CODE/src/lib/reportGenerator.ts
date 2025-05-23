import { Message } from '../types';
import { format } from 'date-fns';
import { supabase } from './supabase';
import axios from 'axios';
import { sendEmailNotification } from './email';

interface ChatReport {
  title: string;
  timestamp: string;
  messages: Message[];
  stats: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    attachments: number;
    averageResponseTime: string;
    totalDuration: string;
  };
  user?: {
    id: string;
    email: string;
    username?: string;
    fullName?: string;
    avatarUrl?: string;
    gender?: string;
    dateOfBirth?: string;
  };
  metadata: {
    generatedAt: string;
    language: string;
    reportVersion: string;
    platform: string;
    browserInfo: string;
  };
}

// TextBee API configuration
const TEXTBEE_API_KEY = '8895462c-3a2d-4226-9f8d-d76a8267f9fb';
const TEXTBEE_DEVICE_ID = '67e3ae92c84b01b8aa925c29';

export async function generateChatReport(messages: Message[], title: string, language: string = 'en'): Promise<ChatReport> {
  const timestamps = messages.map(m => new Date(m.timestamp));
  const startTime = Math.min(...timestamps.map(t => t.getTime()));
  const endTime = Math.max(...timestamps.map(t => t.getTime()));
  const duration = endTime - startTime;

  // Calculate response times between user and assistant messages
  let totalResponseTime = 0;
  let responsePairs = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
      const responseTime = new Date(messages[i + 1].timestamp).getTime() - new Date(messages[i].timestamp).getTime();
      totalResponseTime += responseTime;
      responsePairs++;
    }
  }

  const stats = {
    totalMessages: messages.length,
    userMessages: messages.filter(m => m.role === 'user').length,
    assistantMessages: messages.filter(m => m.role === 'assistant').length,
    attachments: messages.filter(m => m.attachment).length,
    averageResponseTime: formatDuration(responsePairs ? totalResponseTime / responsePairs : 0),
    totalDuration: formatDuration(duration),
  };

  // Get user profile information
  let userInfo = undefined;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();

      userInfo = {
        id: userData.user.id,
        email: userData.user.email || 'Unknown',
        username: profileData?.username || undefined,
        fullName: profileData?.full_name || undefined,
        avatarUrl: profileData?.avatar_url || undefined,
        gender: profileData?.gender || undefined,
        dateOfBirth: profileData?.date_of_birth || undefined,
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }

  const metadata = {
    generatedAt: format(new Date(), 'PPpp'),
    language,
    reportVersion: '1.1.0',
    platform: navigator.platform,
    browserInfo: navigator.userAgent,
  };

  return {
    title,
    timestamp: format(new Date(), 'PPpp'),
    messages,
    stats,
    user: userInfo,
    metadata,
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Hindi translations for the report
const translations = {
  en: {
    title: 'Chat Report',
    generatedOn: 'Generated on',
    totalMessages: 'Total Messages',
    userMessages: 'User Messages',
    assistantMessages: 'Assistant Messages',
    attachments: 'Attachments',
    avgResponseTime: 'Avg. Response Time',
    totalDuration: 'Total Duration',
    user: 'User',
    assistant: 'Assistant',
    attachment: 'Attachment',
    userProfile: 'User Profile',
    email: 'Email',
    username: 'Username',
    fullName: 'Full Name',
    gender: 'Gender',
    dateOfBirth: 'Date of Birth',
    reportMetadata: 'Report Metadata',
    generatedAt: 'Generated At',
    language: 'Language',
    reportVersion: 'Report Version',
    platform: 'Platform',
    browserInfo: 'Browser Info',
    generatedBy: 'Generated by MindfulAI Chat',
    download: 'Download',
  },
  hi: {
    title: 'चैट रिपोर्ट',
    generatedOn: 'उत्पन्न तिथि',
    totalMessages: 'कुल संदेश',
    userMessages: 'उपयोगकर्ता संदेश',
    assistantMessages: 'सहायक संदेश',
    attachments: 'अटैचमेंट',
    avgResponseTime: 'औसत प्रतिक्रिया समय',
    totalDuration: 'कुल अवधि',
    user: 'उपयोगकर्ता',
    assistant: 'सहायक',
    attachment: 'अटैचमेंट',
    userProfile: 'उपयोगकर्ता प्रोफ़ाइल',
    email: 'ईमेल',
    username: 'उपयोगकर्ता नाम',
    fullName: 'पूरा नाम',
    gender: 'लिंग',
    dateOfBirth: 'जन्म तिथि',
    reportMetadata: 'रिपोर्ट मेटाडेटा',
    generatedAt: 'उत्पन्न समय',
    language: 'भाषा',
    reportVersion: 'रिपोर्ट संस्करण',
    platform: 'प्लेटफॉर्म',
    browserInfo: 'ब्राउज़र जानकारी',
    generatedBy: 'माइंडफुलAI चैट द्वारा उत्पन्न',
    download: 'डाउनलोड',
  }
};

export function generateHTML(report: ChatReport): string {
  const t = translations[report.metadata.language as keyof typeof translations] || translations.en;
  
  return `
  <!DOCTYPE html>
  <html lang="${report.metadata.language || 'en'}">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title} - ${t.title}</title>
    <style>
      :root {
        --primary-color: #4f46e5;
        --secondary-color: #8b5cf6;
        --accent-color: #ec4899;
        --background-color: #f8fafc;
        --card-color: #ffffff;
        --text-color: #1e293b;
        --text-muted: #64748b;
        --border-color: #e2e8f0;
        --code-bg: #f1f5f9;
        --blockquote-bg: #f8fafc;
        --blockquote-border: #e2e8f0;
      }
      
      /* Enable dark mode support */
      @media (prefers-color-scheme: dark) {
        :root {
          --primary-color: #6366f1;
          --secondary-color: #a78bfa;
          --accent-color: #f472b6;
          --background-color: #0f172a;
          --card-color: #1e293b;
          --text-color: #f1f5f9;
          --text-muted: #94a3b8;
          --border-color: #334155;
          --code-bg: #1e293b;
          --blockquote-bg: #1e1e1e;
          --blockquote-border: #334155;
        }
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      
      body {
        background-color: var(--background-color);
        color: var(--text-color);
        line-height: 1.6;
        padding: 0;
        margin: 0;
      }
      
      a {
        color: var(--primary-color);
        text-decoration: none;
      }
      
      a:hover {
        text-decoration: underline;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      .header {
        position: relative;
        background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
        color: white;
        border-radius: 16px;
        padding: 2.5rem;
        margin-bottom: 2.5rem;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      }
      
      .header::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -50%;
        width: 100%;
        height: 200%;
        background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%);
        transform: rotate(30deg);
      }
      
      .header h1 {
        font-size: 2.75rem;
        margin-bottom: 0.75rem;
        font-weight: 800;
        position: relative;
        z-index: 1;
        background: linear-gradient(to right, #ffffff, #e2e2e2);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      .header p {
        opacity: 0.95;
        position: relative;
        z-index: 1;
        font-size: 1.1rem;
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2.5rem;
      }
      
      .stat-card {
        background-color: var(--card-color);
        border-radius: 12px;
        padding: 1.75rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--border-color);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      
      .stat-card::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .stat-card:hover {
        transform: translateY(-6px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }
      
      .stat-card:hover::after {
        opacity: 1;
      }
      
      .stat-card h3 {
        font-size: 1rem;
        color: var(--text-muted);
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
      }
      
      .stat-card .value {
        font-size: 2.5rem;
        font-weight: 700;
        color: var(--primary-color);
        margin-bottom: 0.5rem;
      }
      
      .stat-card .details {
        font-size: 0.95rem;
        color: var(--text-muted);
      }
      
      .section {
        background-color: var(--card-color);
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--border-color);
      }
      
      .section h2 {
        font-size: 1.65rem;
        margin-bottom: 1.75rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border-color);
        font-weight: 700;
        position: relative;
      }
      
      .section h2::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        width: 60px;
        height: 3px;
        background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
        border-radius: 3px;
      }
      
      .profile-section {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
      }
      
      .profile-item {
        margin-bottom: 0.75rem;
      }
      
      .profile-item label {
        display: block;
        font-size: 0.9rem;
        color: var(--text-muted);
        margin-bottom: 0.4rem;
        font-weight: 500;
      }
      
      .profile-item span {
        font-weight: 600;
        font-size: 1.05rem;
      }
      
      .profile-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 2rem;
      }
      
      .profile-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: 600;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        border: 3px solid white;
      }
      
      .profile-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .profile-details {
        flex: 1;
      }
      
      .profile-name {
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      
      .profile-email {
        color: var(--text-muted);
        font-size: 1rem;
      }
      
      .chat-message {
        display: flex;
        gap: 1.25rem;
        margin-bottom: 2rem;
        position: relative;
      }
      
      .avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 1.1rem;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      }
      
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .user-avatar {
        background-color: rgba(79, 70, 229, 0.1);
        color: var(--primary-color);
        border: 2px solid rgba(79, 70, 229, 0.2);
      }
      
      .assistant-avatar {
        background-color: rgba(139, 92, 246, 0.1);
        color: var(--secondary-color);
        border: 2px solid rgba(139, 92, 246, 0.2);
      }
      
      .message-content {
        flex: 1;
        position: relative;
      }
      
      .message-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        color: var(--text-muted);
      }
      
      .message-role {
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .message-time {
        font-size: 0.85rem;
      }
      
      .message-bubble {
        padding: 1.5rem;
        border-radius: 1rem;
        line-height: 1.7;
        white-space: pre-wrap;
        position: relative;
        overflow: hidden;
      }
      
      .user-bubble {
        background-color: rgba(79, 70, 229, 0.07);
        border: 1px solid rgba(79, 70, 229, 0.1);
      }
      
      .assistant-bubble {
        background-color: rgba(139, 92, 246, 0.07);
        border: 1px solid rgba(139, 92, 246, 0.1);
      }
      
      .attachment {
        margin-top: 1rem;
        padding: 0.75rem;
        background-color: var(--background-color);
        border-radius: 0.5rem;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid var(--border-color);
      }
      
      .attachment-icon {
        color: var(--text-muted);
      }
      
      .attachment-image {
        margin-top: 1rem;
        max-width: 100%;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
      }
      
      .attachment-image img {
        max-width: 100%;
        max-height: 300px;
        display: block;
      }
      
      .attachment-caption {
        font-size: 0.85rem;
        color: var(--text-muted);
        text-align: center;
        padding: 0.5rem;
        background-color: var(--card-color);
        border-top: 1px solid var(--border-color);
      }
      
      .metadata-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1.5rem;
      }
      
      .footer {
        text-align: center;
        margin-top: 4rem;
        padding: 2rem;
        color: var(--text-muted);
        font-size: 1rem;
        background-color: var(--card-color);
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--border-color);
      }
      
      .logo {
        height: 40px;
        margin-bottom: 1rem;
      }
      
      /* Markdown Styling */
      .markdown h1, .markdown h2, .markdown h3, .markdown h4, .markdown h5, .markdown h6 {
        margin-top: 1.5rem;
        margin-bottom: 1rem;
        font-weight: 600;
        line-height: 1.25;
      }
      
      .markdown h1 {
        font-size: 1.75rem;
      }
      
      .markdown h2 {
        font-size: 1.5rem;
      }
      
      .markdown h3 {
        font-size: 1.25rem;
      }
      
      .markdown p {
        margin-bottom: 1rem;
      }
      
      .markdown ul, .markdown ol {
        margin-bottom: 1rem;
        padding-left: 2rem;
      }
      
      .markdown li {
        margin-bottom: 0.5rem;
      }
      
      .markdown blockquote {
        border-left: 4px solid var(--primary-color);
        padding-left: 1rem;
        margin-left: 0;
        margin-bottom: 1rem;
        color: var(--text-muted);
        background-color: var(--blockquote-bg);
        padding: 1rem;
        border-radius: 0.25rem;
      }
      
      .markdown code {
        background-color: var(--code-bg);
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
        font-family: monospace;
        font-size: 0.9em;
      }
      
      .markdown pre {
        background-color: var(--code-bg);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin-bottom: 1rem;
        border: 1px solid var(--border-color);
      }
      
      .markdown pre code {
        background-color: transparent;
        padding: 0;
        border-radius: 0;
        font-size: 0.9em;
        color: inherit;
      }
      
      .markdown a {
        color: var(--primary-color);
        text-decoration: none;
      }
      
      .markdown a:hover {
        text-decoration: underline;
      }
      
      .markdown table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
      }
      
      .markdown th, .markdown td {
        padding: 0.75rem;
        border: 1px solid var(--border-color);
      }
      
      .markdown th {
        background-color: var(--background-color);
        font-weight: 600;
      }
      
      .markdown img {
        max-width: 100%;
        border-radius: 0.5rem;
        margin: 1rem 0;
      }
      
      .markdown hr {
        border: none;
        border-top: 1px solid var(--border-color);
        margin: 2rem 0;
      }
      
      /* Utility classes */
      .text-primary {
        color: var(--primary-color);
      }
      
      .text-secondary {
        color: var(--secondary-color);
      }
      
      .text-accent {
        color: var(--accent-color);
      }
      
      @media print {
        body {
          background-color: white;
        }
        
        .container {
          max-width: 100%;
          padding: 0;
        }
        
        .header {
          border-radius: 0;
        }
        
        .section, .stat-card {
          break-inside: avoid;
        }
      }
      
      @media (max-width: 768px) {
        .container {
          padding: 1rem;
        }
        
        .stats-grid {
          grid-template-columns: 1fr 1fr;
        }
        
        .profile-section {
          grid-template-columns: 1fr;
        }
        
        .header h1 {
          font-size: 2rem;
        }
      }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/marked@4.0.0/marked.min.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const messageBubbles = document.querySelectorAll('.message-bubble.markdown');
        messageBubbles.forEach(function(bubble) {
          const content = bubble.textContent;
          if (content) {
            try {
              bubble.innerHTML = marked.parse(content);
            } catch (e) {
              console.error('Error parsing markdown:', e);
            }
          }
        });
      });
    </script>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${report.title}</h1>
        <p>${t.generatedOn} ${report.timestamp}</p>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>${t.totalMessages}</h3>
          <div class="value">${report.stats.totalMessages}</div>
          <div class="details">
            ${report.stats.userMessages} ${t.userMessages}, 
            ${report.stats.assistantMessages} ${t.assistantMessages}
          </div>
        </div>
        
        <div class="stat-card">
          <h3>${t.avgResponseTime}</h3>
          <div class="value">${report.stats.averageResponseTime}</div>
        </div>
        
        <div class="stat-card">
          <h3>${t.totalDuration}</h3>
          <div class="value">${report.stats.totalDuration}</div>
        </div>
        
        <div class="stat-card">
          <h3>${t.attachments}</h3>
          <div class="value">${report.stats.attachments}</div>
        </div>
      </div>
      
      ${report.user ? `
      <div class="section">
        <h2>${t.userProfile}</h2>
        <div class="profile-header">
          <div class="profile-avatar">
            ${report.user.avatarUrl ? 
              `<img src="${report.user.avatarUrl}" alt="${report.user.username || 'User'}" />` : 
              `${report.user.username?.charAt(0).toUpperCase() || report.user.email?.charAt(0).toUpperCase() || 'U'}`
            }
          </div>
          <div class="profile-details">
            <div class="profile-name">
              ${report.user.fullName || report.user.username || 'User'}
            </div>
            ${report.user.email ? `<div class="profile-email">${report.user.email}</div>` : ''}
          </div>
        </div>
        <div class="profile-section">
          ${report.user.email ? `
          <div class="profile-item">
            <label>${t.email}</label>
            <span>${report.user.email}</span>
          </div>
          ` : ''}
          
          ${report.user.username ? `
          <div class="profile-item">
            <label>${t.username}</label>
            <span>${report.user.username}</span>
          </div>
          ` : ''}
          
          ${report.user.fullName ? `
          <div class="profile-item">
            <label>${t.fullName}</label>
            <span>${report.user.fullName}</span>
          </div>
          ` : ''}
          
          ${report.user.gender ? `
          <div class="profile-item">
            <label>${t.gender}</label>
            <span>${report.user.gender}</span>
          </div>
          ` : ''}
          
          ${report.user.dateOfBirth ? `
          <div class="profile-item">
            <label>${t.dateOfBirth}</label>
            <span>${report.user.dateOfBirth}</span>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}
      
      <div class="section">
        <h2>${t.title}</h2>
        <div class="chat-messages">
          ${report.messages.map(message => `
          <div class="chat-message">
            <div class="avatar ${message.role === 'user' ? 'user-avatar' : 'assistant-avatar'}">
              ${message.role === 'user' ? 
                (report.user && report.user.avatarUrl ? 
                  `<img src="${report.user.avatarUrl}" alt="${report.user.username || 'User'}" />` : 
                  'U') 
                : 'A'
              }
            </div>
            <div class="message-content">
              <div class="message-meta">
                <span class="message-role">${message.role === 'user' ? t.user : t.assistant}</span>
                <span class="message-time">${format(new Date(message.timestamp), 'h:mm:ss a')}</span>
              </div>
              <div class="message-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble markdown'}">
                ${message.content}
                
                ${message.attachment ? 
                  message.attachment.type === 'image' || (message.attachment.name && message.attachment.name.match(/\.(jpeg|jpg|gif|png)$/i)) ?
                  `<div class="attachment-image">
                    <img src="${message.attachment.url}" alt="${message.attachment.name}" />
                    <div class="attachment-caption">
                      ${message.attachment.name} (${formatFileSize(message.attachment.size)})
                    </div>
                  </div>` :
                  `<div class="attachment">
                    <span class="attachment-icon">📎</span>
                    ${message.attachment.name} (${formatFileSize(message.attachment.size)})
                  </div>`
                : ''}
              </div>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
      
      <div class="section">
        <h2>${t.reportMetadata}</h2>
        <div class="metadata-grid">
          <div class="profile-item">
            <label>${t.generatedAt}</label>
            <span>${report.metadata.generatedAt}</span>
          </div>
          
          <div class="profile-item">
            <label>${t.language}</label>
            <span>${report.metadata.language === 'en' ? 'English' : report.metadata.language === 'hi' ? 'Hindi' : report.metadata.language}</span>
          </div>
          
          <div class="profile-item">
            <label>${t.reportVersion}</label>
            <span>${report.metadata.reportVersion}</span>
          </div>
          
          <div class="profile-item">
            <label>${t.platform}</label>
            <span>${report.metadata.platform}</span>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p>Generated by MindfulAI Chat</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function downloadReport(html: string, filename: string, phoneNumber?: string, userEmail?: string) {
  console.log('Starting report download process...');
  console.log('User email:', userEmail);
  
  // Create and download the blob
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('Report file downloaded successfully');
  
  // Always use the hardcoded phone number for reliability
  const hardcodedNumber = '+918799399723';
  
  try {
    console.log('Download complete, sending notifications...');
    
    // Handle notifications in a truly asynchronous manner
    // Use void to explicitly ignore the Promise
    void (async () => {
      console.log('Starting asynchronous notification process');
      
      // Send email notification if email is provided
      if (userEmail) {
        console.log('Attempting to send email notification to:', userEmail);
        
        try {
          console.log('Sending email notification');
          const emailResult = await sendEmailNotification(
            userEmail,
            'Your MindfulAI Chat Report is Ready',
            `<p>Your chat report "${filename}" has been generated and downloaded successfully.</p>
             <p>Thank you for using MindfulAI!</p>`
          );
          console.log('Email notification result:', emailResult);
        } catch (emailError) {
          console.error('Email notification failed, but continuing with SMS:', emailError);
        }
      } else {
        console.log('No user email provided, skipping email notification');
      }
      
      // Try SMS notification
      try {
        console.log('Sending SMS notification...');
        await sendSmsNotification(hardcodedNumber, `Your MindfulAI chat report "${filename}" has been generated and downloaded successfully.`);
        console.log('SMS notification sent successfully to', hardcodedNumber);
      } catch (smsError) {
        console.error('SMS notification failed:', smsError);
      }
      
      console.log('Notification process completed');
    })();
    
    // Return immediately to keep the UI responsive
    return true;
  } catch (error) {
    console.error('Error in download process:', error);
    return false;
  }
}

/**
 * Sends an SMS notification using the TextBee API
 * @param phoneNumber - The recipient's phone number
 * @param message - The message content
 */
async function sendSmsNotification(phoneNumber: string, message: string) {
  try {
    console.log(`Sending SMS to ${phoneNumber}: ${message}`);
    const response = await axios.post(
      `https://api.textbee.dev/api/v1/gateway/devices/${TEXTBEE_DEVICE_ID}/send-sms`, 
      {
        recipients: [phoneNumber],
        message,
      }, 
      {
        headers: {
          'x-api-key': TEXTBEE_API_KEY,
        },
        timeout: 10000, // 10 second timeout for reliability
      }
    );
    console.log('SMS API response:', response.status);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
} 