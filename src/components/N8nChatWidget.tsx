"use client";

import { useEffect } from "react";

export default function N8nChatWidget() {
  useEffect(() => {
    // Inject the n8n chat stylesheet
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // Inject the n8n chat module script
    const script = document.createElement("script");
    script.type = "module";
    script.innerHTML = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

      createChat({
        webhookUrl: 'https://n8n.smartden.online/webhook/b74ab3f2-ac1b-416d-8da0-801d3726cd65/chat',
        initialMessages: [
          'Hi there! 👋',
          'My name is Nathan. How can I assist you today?'
        ],
        onResponseReceived: (message) => {
          console.log('n8n response received:', message);
          // Dispatch a custom event to update the SalonList
          window.dispatchEvent(new CustomEvent('n8n-chat-response', { 
            detail: { text: message.text || '' } 
          }));
        },
        theme: {
          color: {
            primary: '#06b6d4',      // Cyan 500
            secondary: '#d946ef',    // Fuchsia 500
            background: '#020617',   // Slate 950
            surface: '#0f172a',      // Slate 900
            border: '#1e293b',       // Slate 800
            text: '#f1f5f9',         // Slate 100
            textLight: '#94a3b8'     // Slate 400
          },
          font: {
            family: 'inherit'
          },
          button: {
            backgroundColor: '#06b6d4',
            textColor: '#020617'
          }
        }
      });
    `;
    document.body.appendChild(script);

    // CSS Overrides since the default theme object is limited
    const styleLink = document.createElement("style");
    styleLink.innerHTML = `
      :root {
        --chat--color-light: #020617 !important;
        --chat--color-light-shade-50: #0f172a !important;
        --chat--color-light-shade-100: #1e293b !important;
        --chat--color-dark: #f8fafc !important;
        --chat--color-dark-shade-50: #cbd5e1 !important;
        --chat--spacing: 1rem !important;
      }
      .chat-layout {
        background-color: #020617 !important;
      }
      .chat-message {
        background-color: #0f172a !important;
        color: #f8fafc !important;
      }
      .chat-footer {
        background-color: #0f172a !important;
        border-top: 1px solid #1e293b !important;
      }
      .chat-input {
        background-color: #020617 !important;
        color: #f8fafc !important;
      }
      .chat-input::placeholder {
        color: #475569 !important;
      }
    `;
    document.head.appendChild(styleLink);

    // Cleanup on unmount
    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
      document.head.removeChild(styleLink);
    };
  }, []);

  return null;
}
