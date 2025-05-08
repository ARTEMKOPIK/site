import React, { useEffect, useRef, useState, useMemo, KeyboardEvent, ChangeEvent } from 'react';
import styled, { keyframes } from 'styled-components';
import ReactMarkdown from 'react-markdown';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import './notebook-animations.css';
import { renderToStaticMarkup } from 'react-dom/server';
import { authorSupport } from './authorSupport';
import { createClient } from 'webdav';
import { useState as useReactState } from 'react';

const LOCAL_STORAGE_KEY = 'notebook-multinotes-v1';
const SETTINGS_KEY = 'notebook-settings-v1';

// --- Crypto helpers ---
async function getKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getKeyFromPassword(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data)
  );
  // Сохраняем salt, iv и ciphertext in base64
  return [
    btoa(String.fromCharCode(...salt)),
    btoa(String.fromCharCode(...iv)),
    btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  ].join('.');
}

async function decryptData(cipher: string, password: string): Promise<string> {
  const [saltB64, ivB64, dataB64] = cipher.split('.');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0));
  const key = await getKeyFromPassword(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}

const PASSWORD_KEY = 'notebook-password-set-v1';
const ENCRYPTED_KEY = 'notebook-multinotes-encrypted-v1';

// --- Styled Components ---
const Layout = styled.div`
  display: flex;
  width: 100%;
  max-width: 760px;
  min-height: 600px;
  background: ${({ theme }) => theme.colors.backgroundLight};
  color: ${({ theme }) => theme.colors.textLight};
  border-radius: 18px;
  box-shadow: 0 8px 40px 0 rgba(99,102,241,0.13);
  overflow: hidden;
  border: 1.5px solid ${({ theme }) => theme.colors.borderLight};
  @media (max-width: 900px) {
    max-width: 98vw;
  }
  @media (max-width: 700px) {
    flex-direction: column;
    min-height: 0;
    max-width: 100vw;
    border-radius: 0;
    box-shadow: none;
  }
`;

const Sidebar = styled.div`
  width: 220px;
  background: ${({ theme }) => theme.colors.background};
  border-right: 1.5px solid ${({ theme }) => theme.colors.borderLight};
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 20px 0 20px 0;
  gap: 10px;
  flex: 1 1 0;
  @media (max-width: 700px) {
    width: 100vw;
    border-right: none;
    border-bottom: 1.5px solid ${({ theme }) => theme.colors.borderLight};
    flex-direction: row;
    overflow-x: auto;
    padding: 0;
    gap: 0;
  }
`;

const SidebarInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
  position: relative;
`;

const SidebarInput = styled.input`
  flex: 1;
  padding: 6px 36px 6px 10px;
  border-radius: 8px;
  border: 1.2px solid #ddd;
  font-size: 1em;
  height: 36px;
`;

const AddFolderBtn = styled.button`
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  font-size: 1.2em;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
  &:hover { background: #4f46e5; }
`;

// Универсальный компонент для всех кнопок приложения
const UniButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  min-width: 44px;
  padding: 0 22px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1.08rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
  will-change: transform;
  outline: none;
  &:hover {
    background: #4f46e5;
    box-shadow: 0 4px 16px 0 rgba(99,102,241,0.18);
    transform: translateY(-2px) scale(1.04);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const NotesList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  @media (max-width: 700px) {
    flex-direction: row;
    overflow-x: auto;
    gap: 0;
  }
`;

const NoteItem = styled.button<{active: boolean; pinned?: boolean}>`
  background: ${({ active, theme }) => active ? theme.colors.accent : 'transparent'};
  color: ${({ active, theme }) => active ? '#fff' : theme.colors.textLight};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 12px 18px;
  text-align: left;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  margin: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.15s, color 0.15s, box-shadow 0.18s;
  min-height: 44px;
  gap: 8px;
  position: relative;
  box-shadow: ${({ active }) => active ? '0 0 0 3px #6366f1aa' : 'none'};
  &:hover {
    background: ${({ theme, active }) => active ? theme.colors.accent : theme.colors.borderLight};
  }
  &::before {
    content: '';
    display: ${({ pinned }) => pinned ? 'block' : 'none'};
    position: absolute;
    left: 0; top: 6px; bottom: 6px;
    width: 5px;
    border-radius: 4px;
    background: #f59e42;
  }
  @media (max-width: 700px) {
    min-width: 140px;
    margin: 0 2px;
    font-size: 0.98rem;
    padding: 12px 8px;
  }
`;

const NoteTitleInput = styled.input`
  font-size: 1rem;
  font-weight: 500;
  border: none;
  background: transparent;
  color: inherit;
  width: 100%;
  outline: none;
`;

const AddNoteBtn = styled.button`
  background: ${({ theme }) => theme.colors.accent};
  color: #fff;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 12px 0;
  margin: 0 10px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s;
  min-height: 44px;
  width: 100%;
  display: block;
  will-change: transform;
  &:hover {
    background: #4f46e5;
    color: #fff;
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 4px 16px 0 rgba(99,102,241,0.10);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.06);
  }
  @media (max-width: 700px) {
    display: none;
  }
`;

const Main = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 32px 24px 32px;
  gap: 18px;
  min-width: 0;
  @media (max-width: 700px) {
    padding: 16px 4vw 16px 4vw;
    gap: 10px;
  }
`;

const Toolbar = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 10px;
  align-items: center;
  justify-content: center;
`;

const StyledTextarea = styled.textarea`
  width: 100%;
  min-height: 320px;
  resize: vertical;
  font-size: 1.15rem;
  font-family: inherit;
  background: transparent;
  color: inherit;
  border: 1.5px solid ${({ theme }) => theme.colors.borderLight};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 18px;
  outline: none;
  transition: border 0.2s;
  &:focus {
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.accent}33;
  }
`;

const Button = styled.button`
  background: ${({ theme }) => theme.colors.accent};
  color: #fff;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 10px 22px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s;
  min-height: 44px;
  min-width: 110px;
  box-shadow: 0 2px 8px 0 rgba(99,102,241,0.06);
  will-change: transform;
  &:hover {
    background: #4f46e5;
    color: #fff;
    box-shadow: 0 4px 16px 0 rgba(99,102,241,0.10);
    transform: translateY(-2px) scale(1.04);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.06);
  }
`;

const Stat = styled.div`
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.textLight}CC;
  display: flex;
  gap: 16px;
  align-items: center;
`;

const SaveStatus = styled.div`
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const SaveIcon = styled.span<{saving: boolean}>`
  display: inline-block;
  font-size: 1.1em;
  color: ${({ theme, saving }) => saving ? theme.colors.accent : theme.colors.success};
  animation: ${({ saving }) => saving ? spin : 'none'} 1s linear infinite;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const Modal = styled.div`
  background: ${({ theme }) => theme.colors.backgroundLight};
  color: ${({ theme }) => theme.colors.textLight};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.18);
  padding: 32px 32px 24px 32px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  justify-content: center;
`;

const TabButton = styled.button<{active: boolean}>`
  background: ${({ active, theme }) => active ? theme.colors.accent : theme.colors.borderLight};
  color: ${({ active, theme }) => active ? '#fff' : theme.colors.textLight};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 10px 0;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  width: 150px;
  transition: background 0.2s, color 0.2s, transform 0.12s, box-shadow 0.18s;
  will-change: transform;
  &:hover {
    background: ${({ theme }) => theme.colors.accent};
    color: #fff;
    transform: translateY(-2px) scale(1.06);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 1px 4px 0 rgba(99,102,241,0.06);
  }
`;

const MarkdownPreview = styled.div`
  width: 100%;
  min-height: 320px;
  background: transparent;
  color: inherit;
  border: 1.5px solid ${({ theme }) => theme.colors.borderLight};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 16px;
  font-size: 1.08rem;
  overflow-x: auto;
  word-break: break-word;
`;

const FormatBar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: center;
  animation: fadeIn 0.4s cubic-bezier(.4,0,.2,1);
`;

const FormatBtn = styled.button`
  background: ${({ theme }) => theme.colors.borderLight};
  color: ${({ theme }) => theme.colors.textLight};
  border: none;
  border-radius: 8px;
  width: 38px;
  height: 38px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.18s, transform 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
  &:hover {
    background: ${({ theme }) => theme.colors.accent};
    color: #fff;
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
    transform: translateY(-2px) scale(1.08);
  }
  &:active {
    transform: scale(0.95);
    box-shadow: 0 1px 4px 0 rgba(99,102,241,0.06);
  }
`;

const SearchSortRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 10px 8px 10px;
  @media (max-width: 700px) {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.borderRadius};
  border: 1.5px solid ${({ theme }) => theme.colors.borderLight};
  font-size: 1rem;
  background: ${({ theme }) => theme.colors.backgroundLight};
  color: ${({ theme }) => theme.colors.textLight};
  outline: none;
  transition: border 0.2s;
  &:focus {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

const Highlight = styled.span`
  background: #fde68a;
  color: #b45309;
  border-radius: 4px;
  padding: 0 2px;
`;

const UndoRedoBar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;

const UndoRedoBtn = styled.button`
  background: ${({ theme }) => theme.colors.borderLight};
  color: ${({ theme }) => theme.colors.textLight};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 4px 10px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.12s, box-shadow 0.15s;
  will-change: transform;
  &:hover {
    background: ${({ theme }) => theme.colors.accent};
    color: #fff;
    transform: translateY(-2px) scale(1.07);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  }
  &:active {
    transform: scale(0.95);
    box-shadow: 0 1px 4px 0 rgba(99,102,241,0.06);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SidebarActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 10px 10px 10px;
`;

const ActionBtn = styled.button`
  background: ${({ theme }) => theme.colors.borderLight};
  color: ${({ theme }) => theme.colors.textLight};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 7px 0;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s;
  will-change: transform;
  &:hover {
    background: ${({ theme }) => theme.colors.accent};
    color: #fff;
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 4px 16px 0 rgba(99,102,241,0.10);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.06);
  }
`;

const fontOptions = [
  { label: 'Inter (по умолчанию)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
  { label: 'Fira Mono', value: 'Fira Mono, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Comic Sans', value: 'Comic Sans MS, cursive, sans-serif' },
];

const fontSizeOptions = [
  { label: 'Маленький', value: '15px' },
  { label: 'Стандарт', value: '17px' },
  { label: 'Крупный', value: '20px' },
  { label: 'Очень крупный', value: '24px' },
];

const SettingsBtn = styled.button`
  position: absolute;
  top: 24px;
  left: 32px;
  background: ${({ theme }) => theme.colors.backgroundLight};
  color: ${({ theme }) => theme.colors.textLight};
  border: 1.5px solid ${({ theme }) => theme.colors.borderLight};
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
  z-index: 10;
`;

const SettingsModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
`;

const SettingsModal = styled.div`
  background: ${({ theme }) => theme.colors.backgroundLight};
  color: ${({ theme }) => theme.colors.textLight};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.18);
  padding: 32px 32px 24px 32px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const SettingsRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0 8px 0;
  align-items: center;
`;

const Tag = styled.span`
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 12px;
  padding: 4px 12px 4px 10px;
  font-size: 0.98rem;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.18s, color 0.18s;
  animation: fadeIn 0.3s;
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
`;

const TagRemove = styled.button`
  background: none;
  border: none;
  color: #a21caf;
  font-size: 1.1em;
  margin-left: 2px;
  cursor: pointer;
  padding: 0;
  transition: color 0.18s, transform 0.12s;
  will-change: transform;
  &:hover { color: #be185d; transform: scale(1.18) rotate(-12deg); }
  &:active { transform: scale(0.92) rotate(8deg); }
`;

const TagInput = styled.input`
  border: none;
  outline: none;
  background: #f3f4f6;
  color: #3730a3;
  border-radius: 12px;
  padding: 4px 12px;
  font-size: 0.98rem;
  min-width: 80px;
  height: 32px;
`;

// FAB — отдельный стиль, но унифицирован по цвету и скруглению
const FabBtn = styled.button`
  position: fixed;
  right: 24px;
  bottom: 32px;
  z-index: 300;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 72px;
  height: 72px;
  font-size: 2.6rem;
  box-shadow: 0 12px 48px 0 rgba(99,102,241,0.28);
  cursor: pointer;
  transition: background 0.18s, box-shadow 0.18s, transform 0.16s, opacity 0.3s;
  will-change: transform, opacity;
  opacity: 0;
  animation: fabFadeIn 0.7s 0.2s forwards cubic-bezier(.4,0,.2,1);
  @keyframes fabFadeIn {
    from { opacity: 0; transform: scale(0.8) translateY(40px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  &:hover {
    background: #4f46e5;
    box-shadow: 0 16px 56px 0 rgba(99,102,241,0.32);
    transform: scale(1.12) translateY(-4px);
  }
  &:active {
    transform: scale(0.95);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  }
  @media (max-width: 700px) {
    display: block;
  }
`;

const ExportMenuWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
`;

const ExportMenuBtn = styled.button`
  background: ${({ theme }) => theme.colors.borderLight};
  color: ${({ theme }) => theme.colors.textLight};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 10px 0;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.12s;
  will-change: transform;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  &:hover {
    background: ${({ theme }) => theme.colors.accent};
    color: #fff;
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 4px 16px 0 rgba(99,102,241,0.10);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.06);
  }
`;

const ExportDropdown = styled.div`
  position: absolute;
  top: 110%;
  left: 0;
  width: 220px;
  background: ${({ theme }) => theme.colors.backgroundLight};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
  padding: 10px 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ExportDropdownItem = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textLight};
  font-size: 1rem;
  padding: 10px 18px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: ${({ theme }) => theme.colors.accent}22;
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const EmptyState = styled.div.attrs(() => ({ role: 'status', 'aria-live': 'polite' }))`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 220px;
  color: #aaa;
  font-size: 1.35rem;
  font-weight: 700;
  animation: fadeIn 0.7s cubic-bezier(.4,0,.2,1);
  border-radius: 18px;
  box-shadow: 0 2px 12px 0 rgba(99,102,241,0.07);
  margin-top: 40px;
`;

const EmptyIllustration = () => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginBottom:12}}>
    <rect x="10" y="20" width="60" height="40" rx="10" fill="#e0e7ff"/>
    <rect x="20" y="30" width="40" height="6" rx="3" fill="#c7d2fe"/>
    <rect x="20" y="42" width="28" height="6" rx="3" fill="#c7d2fe"/>
    <rect x="20" y="54" width="18" height="6" rx="3" fill="#c7d2fe"/>
  </svg>
);

// SVG-иконки для меню экспорта/импорта
const IconExport = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M10 2v12m0 0l-4-4m4 4l4-4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="16" width="14" height="2" rx="1" fill="#6366f1"/></svg>
);
const IconImport = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M10 18V6m0 0l-4 4m4-4l4 4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="2" width="14" height="2" rx="1" fill="#22c55e"/></svg>
);
const IconMd = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><rect x="2" y="4" width="16" height="12" rx="3" fill="#f59e42"/><text x="10" y="14" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">MD</text></svg>
);
const IconNote = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="3" fill="#6366f1"/><rect x="7" y="8" width="6" height="2" rx="1" fill="#fff"/><rect x="7" y="12" width="4" height="2" rx="1" fill="#fff"/></svg>
);
const IconMenu = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 22 22"><circle cx="11" cy="5" r="2" fill="#6366f1"/><circle cx="11" cy="11" r="2" fill="#6366f1"/><circle cx="11" cy="17" r="2" fill="#6366f1"/></svg>
);

// SVG-иконки для форматирования
const IconBold = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><text x="4" y="15" fontWeight="bold" fontSize="15" fill="#6366f1">B</text></svg>);
const IconItalic = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><text x="7" y="15" fontStyle="italic" fontSize="15" fill="#6366f1">I</text></svg>);
const IconHeader = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><text x="2" y="15" fontWeight="bold" fontSize="15" fill="#6366f1">H</text></svg>);
const IconList = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="6" cy="7" r="2" fill="#6366f1"/><rect x="10" y="6" width="6" height="2" rx="1" fill="#6366f1"/><circle cx="6" cy="13" r="2" fill="#6366f1"/><rect x="10" y="12" width="6" height="2" rx="1" fill="#6366f1"/></svg>);
const IconLink = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M7 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" stroke="#6366f1" strokeWidth="2"/><path d="M13 7a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" stroke="#6366f1" strokeWidth="2"/></svg>);
const IconInlineCode = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="6" width="14" height="8" rx="2" fill="#6366f1"/><text x="10" y="14" textAnchor="middle" fontSize="8" fill="#fff">{'<>'}</text></svg>);
const IconBlockCode = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="3" fill="#6366f1"/><text x="10" y="14" textAnchor="middle" fontSize="8" fill="#fff">{'{ }'}</text></svg>);
const IconClear = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="4" y="4" width="12" height="12" rx="3" fill="#ef4444"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="2"/></svg>);
const IconCopy = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="6" y="6" width="8" height="8" rx="2" fill="#6366f1"/><rect x="4" y="4" width="8" height="8" rx="2" fill="#a5b4fc"/></svg>);
const IconPrint = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="4" y="8" width="12" height="8" rx="2" fill="#f59e42"/><rect x="6" y="4" width="8" height="4" rx="1" fill="#6366f1"/></svg>);
const IconDelete = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="4" y="4" width="12" height="12" rx="3" fill="#ef4444"/><path d="M7 7l6 6M13 7l-6 6" stroke="#fff" strokeWidth="2"/></svg>);
const IconFolder = () => (<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="16" height="10" rx="2" fill="#6366f1"/><rect x="2" y="4" width="6" height="4" rx="1" fill="#a5b4fc"/></svg>);

// --- Types ---
type TagObj = { name: string; color: string };
type Folder = { id: string; name: string };
type Note = {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: TagObj[];
  reminder: number | null;
  pinned: boolean;
  folderId?: string | null;
};

const TAG_COLORS = [
  '#6366f1', // фиолетовый
  '#22c55e', // зелёный
  '#f59e42', // оранжевый
  '#ef4444', // красный
  '#0ea5e9', // голубой
  '#eab308', // жёлтый
  '#a21caf', // пурпурный
  '#18181b', // чёрный
  '#f3f4f6', // серый
];

// --- Helpers ---
function getStats(text: string) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { chars, words };
}

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// --- Main Component ---
export function Notebook() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'clear' | 'delete' | null>(null);
  const [copied, setCopied] = useState(false);
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'edit' | 'preview' | 'support'>('edit');
  const [search, setSearch] = useState('');
  const [undoStack, setUndoStack] = useState<{[id: string]: string[]}>({});
  const [redoStack, setRedoStack] = useState<{[id: string]: string[]}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '') || {
        font: fontOptions[0].value,
        fontSize: fontSizeOptions[1].value,
        autosave: true,
      };
    } catch {
      return {
        font: fontOptions[0].value,
        fontSize: fontSizeOptions[1].value,
        autosave: true,
      };
    }
  });
  const [tagInput, setTagInput] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [reminderInput, setReminderInput] = useState('');
  const [notifiedReminders, setNotifiedReminders] = useState<{[id: string]: number}>({});
  const [notifPermission, setNotifPermission] = useState(Notification?.permission || 'default');
  const [sortBy, setSortBy] = useState<'updated'|'created'|'title'|'tag'>('updated');
  const notesListRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<{[id: string]: HTMLButtonElement | null}>({});
  const [webdav, setWebdav] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('webdav-settings') || '{}');
    } catch { return {}; }
  });
  const [syncToast, setSyncToast] = useState<string|null>(null);
  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('notebook-folders-v1') || '[]');
    } catch { return []; }
  });
  const [draggedNoteId, setDraggedNoteId] = useState<string|null>(null);
  const [dropTarget, setDropTarget] = useState<string|null>(null); // folderId или 'none'
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const [exportMenuOpen, setExportMenuOpen] = useReactState(false);

  // Ловушка фокуса для окна настроек
  useEffect(() => {
    function trapFocus(e: globalThis.KeyboardEvent) {
      if (!showSettings) return;
      const modal = settingsModalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    if (showSettings) {
      document.addEventListener('keydown', trapFocus);
      setTimeout(() => {
        const modal = settingsModalRef.current;
        if (modal) {
          const focusable = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length) focusable[0].focus();
        }
      }, 0);
    }
    return () => document.removeEventListener('keydown', trapFocus);
  }, [showSettings]);
  useEffect(() => {
    if (!showSettings && settingsBtnRef.current) settingsBtnRef.current.focus();
  }, [showSettings]);

  // --- Load notes from localStorage ---
  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        let arr = JSON.parse(raw);
        // Миграция: если tags — массив строк, преобразуем в массив объектов
        arr = arr.map((n: any) => ({
          ...n,
          tags: Array.isArray(n.tags)
            ? n.tags.map((t: any) => typeof t === 'string' ? { name: t, color: TAG_COLORS[0] } : t)
            : [],
          reminder: typeof n.reminder === 'number' ? n.reminder : null,
          pinned: typeof n.pinned === 'boolean' ? n.pinned : false,
        }));
        setNotes(arr);
        if (arr.length > 0) setActiveId(arr[0].id);
      } catch {
        // intentionally empty: ignore JSON parse errors
      }
    } else {
      // Создаём первую заметку по умолчанию
      const first: Note = {
        id: genId(),
        title: 'Первая заметка',
        content: '',
        created: Date.now(),
        updated: Date.now(),
        tags: [],
        reminder: null,
        pinned: false,
      };
      setNotes([first]);
      setActiveId(first.id);
    }
  }, []);

  // --- Save notes to localStorage ---
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // --- Active note ---
  const activeNote = notes.find(n => n.id === activeId) || null;

  // --- Save content with animation ---
  useEffect(() => {
    if (!activeNote) return;
    if (saved) return;
    setSaving(true);
    const timeout = setTimeout(() => {
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: activeNote.content, updated: Date.now() } : n));
      setSaved(true);
      setSaving(false);
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line
  }, [activeNote?.content, saved]);

  // --- Сбросить redoStack при изменении заметки ---
  useEffect(() => {
    if (!activeNote) return;
    setRedoStack(prev => ({ ...prev, [activeNote.id]: [] }));
    // eslint-disable-next-line
  }, [activeNote?.content]);

  // --- Инициализация undoStack при загрузке заметок ---
  useEffect(() => {
    setUndoStack(notes.reduce((acc, n) => ({ ...acc, [n.id]: [n.content] }), {}));
    setRedoStack(notes.reduce((acc, n) => ({ ...acc, [n.id]: [] }), {}));
    // eslint-disable-next-line
  }, [notes.length]);

  // --- Сохранять настройки ---
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // --- Применять настройки к body ---
  useEffect(() => {
    document.body.style.fontFamily = settings.font;
    document.body.style.fontSize = settings.fontSize;
  }, [settings.font, settings.fontSize]);

  // --- Проверка и показ уведомлений по напоминаниям ---
  useEffect(() => {
    if (notifPermission !== 'granted') return;
    const interval = setInterval(() => {
      const now = Date.now();
      notes.forEach(note => {
        if (
          note.reminder &&
          note.reminder <= now &&
          (!notifiedReminders[note.id] || notifiedReminders[note.id] < note.reminder)
        ) {
          new Notification('Напоминание', {
            body: note.title + (note.content ? ('\n' + note.content.slice(0, 120)) : ''),
            tag: note.id,
          });
          setNotifiedReminders(prev => ({ ...prev, [note.id]: note.reminder! }));
        }
      });
    }, 15000); // Проверять каждые 15 секунд
    return () => clearInterval(interval);
  }, [notes, notifPermission, notifiedReminders]);

  // --- UI: запросить разрешение на уведомления ---
  const requestNotifPermission = () => {
    Notification.requestPermission().then(p => setNotifPermission(p));
  };

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeNote) return;
    setUndoStack(prev => {
      const stack = prev[activeNote.id] || [];
      // Не добавлять дубликаты подряд
      if (stack[stack.length - 1] === e.target.value) return prev;
      return { ...prev, [activeNote.id]: [...stack, e.target.value] };
    });
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: e.target.value } : n));
    setSaved(false);
  };

  const handleClear = () => {
    setModalType('clear');
    setShowModal(true);
  };

  const confirmClear = () => {
    if (!activeNote) return;
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: '' } : n));
    setSaved(false);
    setShowModal(false);
    textareaRef.current?.focus();
  };

  const handleCopy = async () => {
    if (!activeNote) return;
    try {
      await navigator.clipboard.writeText(activeNote.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      textareaRef.current?.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleAddNote = () => {
    const newNote: Note = {
      id: genId(),
      title: 'Новая заметка',
      content: '',
      created: Date.now(),
      updated: Date.now(),
      tags: [],
      reminder: null,
      pinned: false,
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveId(newNote.id);
    setEditTitleId(newNote.id);
    setTimeout(() => titleInputRef.current?.focus(), 100);
  };

  const handleDeleteNote = (id: string) => {
    setModalType('delete');
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (!activeNote) return;
    setNotes(prev => prev.filter(n => n.id !== activeNote.id));
    setShowModal(false);
    setTimeout(() => {
      // Переключаемся на следующую заметку
      setActiveId(notes.length > 1 ? notes.find(n => n.id !== activeNote.id)?.id || null : null);
    }, 0);
  };

  const cancelModal = () => setShowModal(false);

  const handleTitleEdit = (id: string) => {
    setEditTitleId(id);
    setTimeout(() => titleInputRef.current?.focus(), 100);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title: e.target.value } : n));
  };

  const handleTitleBlur = (id: string) => {
    setEditTitleId(null);
    // Если пустой — вернуть дефолт
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title: n.title.trim() || 'Без названия' } : n));
  };

  const stats = getStats(activeNote?.content || '');

  // Markdown format helpers
  const insertAtCursor = (before: string, after = '', placeholder = '') => {
    if (!textareaRef.current || !activeNote) return;
    const el = textareaRef.current;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    const value = activeNote.content;
    const selected = value.slice(start, end) || placeholder;
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: newValue } : n));
    setSaved(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  // --- Фильтрация заметок по поиску и тегу ---
  const filteredNotes = useMemo(() => {
    let result = notes;
    if (tagFilter) {
      result = result.filter(n => n.tags.some(t => t.name === tagFilter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [notes, search, tagFilter]);

  // Подсветка совпадений в заголовке
  function highlight(text: string, query: string) {
    if (!query) return text;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${q})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? <Highlight key={i}>{part}</Highlight> : part
    );
  }

  // --- Undo ---
  const handleUndo = () => {
    if (!activeNote) return;
    const stack = undoStack[activeNote.id] || [];
    if (stack.length <= 1) return;
    const prevValue = stack[stack.length - 2];
    setUndoStack(prev => ({ ...prev, [activeNote.id]: stack.slice(0, -1) }));
    setRedoStack(prev => ({ ...prev, [activeNote.id]: [activeNote.content, ...(prev[activeNote.id] || [])] }));
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: prevValue } : n));
    setSaved(false);
  };

  // --- Redo ---
  const handleRedo = () => {
    if (!activeNote) return;
    const stack = redoStack[activeNote.id] || [];
    if (stack.length === 0) return;
    const nextValue = stack[0];
    setRedoStack(prev => ({ ...prev, [activeNote.id]: stack.slice(1) }));
    setUndoStack(prev => ({ ...prev, [activeNote.id]: [...(prev[activeNote.id] || []), nextValue] }));
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content: nextValue } : n));
    setSaved(false);
  };

  // --- Горячие клавиши ---
  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      e.preventDefault();
    } else if ((e.ctrlKey && e.key.toLowerCase() === 'y')) {
      handleRedo();
      e.preventDefault();
    }
  };

  // --- Экспорт всех заметок в JSON ---
  const handleExportJSON = () => {
    const data = JSON.stringify(notes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notebook-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Экспорт всех заметок в Markdown ---
  const handleExportAllMarkdown = () => {
    const md = notes.map(n => `# ${n.title}\n\n${n.content}\n`).join('\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notebook-export.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Экспорт одной заметки в Markdown ---
  const handleExportCurrentMarkdown = () => {
    if (!activeNote) return;
    const md = `# ${activeNote.title}\n\n${activeNote.content}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Импорт заметок из JSON ---
  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const arr = JSON.parse(evt.target?.result as string) as Note[];
        // Добавляем только уникальные id
        const existingIds = new Set(notes.map(n => n.id));
        const newNotes = arr.filter(n => !existingIds.has(n.id));
        setNotes(prev => [...prev, ...newNotes]);
      } catch {
        // intentionally empty: ignore JSON parse errors
      }
    };
    reader.readAsText(file);
    // сброс input чтобы можно было импортировать тот же файл повторно
    e.target.value = '';
  };

  // --- Tag handlers ---
  const handleAddTag = () => {
    if (!activeNote) return;
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag || activeNote.tags.some(t => t.name === tag)) return;
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, tags: [...n.tags, { name: tag, color: tagColor }] } : n));
    setTagInput('');
    setTagColor(TAG_COLORS[0]);
    setSaved(false);
  };

  const handleRemoveTag = (tag: string) => {
    if (!activeNote) return;
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, tags: n.tags.filter(t => t.name !== tag) } : n));
    setSaved(false);
  };

  // --- Reminder handlers ---
  const handleSetReminder = () => {
    if (!activeNote) return;
    if (!reminderInput) return;
    const ts = new Date(reminderInput).getTime();
    if (isNaN(ts)) return;
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, reminder: ts } : n));
    setSaved(false);
  };

  const handleRemoveReminder = () => {
    if (!activeNote) return;
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, reminder: null } : n));
    setSaved(false);
    setReminderInput('');
  };

  // --- Helper для форматирования даты ---
  function formatReminder(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  // --- Закрепить/открепить заметку ---
  const handleTogglePin = (id: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    setSaved(false);
  };

  // --- Сортировка заметок ---
  const sortedNotes = useMemo(() => {
    const arr = [...filteredNotes];
    // Сортировка по критерию
    arr.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; // Закреплённые сверху
      if (sortBy === 'updated') return b.updated - a.updated;
      if (sortBy === 'created') return b.created - a.created;
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'ru');
      if (sortBy === 'tag') {
        const at = a.tags[0]?.name || '';
        const bt = b.tags[0]?.name || '';
        return at.localeCompare(bt, 'ru');
      }
      return 0;
    });
    return arr;
  }, [filteredNotes, sortBy]);

  // Прокрутка к новой заметке
  useEffect(() => {
    if (!activeId || !noteRefs.current[activeId]) return;
    noteRefs.current[activeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeId, sortedNotes.length]);

  // --- Печать заметки через отдельное окно ---
  const handlePrint = () => {
    if (!activeNote) return;
    // Генерируем HTML для заметки
    const noteHtml = renderToStaticMarkup(
      <div style={{fontFamily:'Inter,Arial,sans-serif',padding:'32px 24px',color:'#18181b'}}>
        <h1 style={{marginBottom:16}}>{activeNote.title}</h1>
        <div style={{fontSize:'1.1em'}}>
          <ReactMarkdown>{activeNote.content}</ReactMarkdown>
        </div>
      </div>
    );
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>${activeNote.title}</title>
          <style>
            body { background: #fff; color: #18181b; margin: 0; font-family: Inter, Arial, sans-serif; }
            h1 { margin-bottom: 16px; }
            div { font-size: 1.1em; }
          </style>
        </head>
        <body>${noteHtml}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    }
  };

  // --- Сохранять webdav настройки ---
  useEffect(() => {
    localStorage.setItem('webdav-settings', JSON.stringify(webdav));
  }, [webdav]);

  // --- Заглушки для upload/download ---
  const handleWebdavUpload = async () => {
    if (!webdav.url || !webdav.username || !webdav.password) {
      setSyncToast('Заполните все поля WebDAV!');
      setTimeout(() => setSyncToast(null), 2200);
      return;
    }
    setSyncToast('Выгрузка...');
    try {
      const client = createClient(webdav.url, { username: webdav.username, password: webdav.password });
      await client.putFileContents('notebook.json', JSON.stringify(notes), { overwrite: true });
      setSyncToast('Успешно выгружено!');
    } catch (e: any) {
      setSyncToast('Ошибка выгрузки: ' + (e?.message || ''));
    }
    setTimeout(() => setSyncToast(null), 2500);
  };
  const handleWebdavDownload = async () => {
    if (!webdav.url || !webdav.username || !webdav.password) {
      setSyncToast('Заполните все поля WebDAV!');
      setTimeout(() => setSyncToast(null), 2200);
      return;
    }
    setSyncToast('Загрузка...');
    try {
      const client = createClient(webdav.url, { username: webdav.username, password: webdav.password });
      const data = await client.getFileContents('notebook.json', { format: 'text' });
      setNotes(JSON.parse(typeof data === 'string' ? data : String(data)));
      setSyncToast('Заметки загружены!');
    } catch (e: any) {
      setSyncToast('Ошибка загрузки: ' + (e?.message || ''));
    }
    setTimeout(() => setSyncToast(null), 2500);
  };

  // --- iCal экспорт ---
  function exportReminderToIcs(note: Note) {
    if (!note.reminder) return;
    const dt = new Date(note.reminder);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dtStr = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OnlineNotebook//RU',
      'BEGIN:VEVENT',
      `UID:${note.id}@onlinenotebook`,
      `DTSTAMP:${dtStr}`,
      `DTSTART:${dtStr}`,
      `SUMMARY:${note.title}`,
      `DESCRIPTION:${note.content.replace(/\n/g, '\\n')}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title || 'reminder'}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Save folders to localStorage ---
  useEffect(() => {
    localStorage.setItem('notebook-folders-v1', JSON.stringify(folders));
  }, [folders]);

  // --- UI: создание/удаление папок ---
  const [newFolderName, setNewFolderName] = useState('');
  const handleAddFolder = () => {
    const name = newFolderName.trim();
    if (!name || folders.some(f => f.name === name)) return;
    setFolders(prev => [...prev, { id: genId(), name }]);
    setNewFolderName('');
  };
  const handleDeleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: null } : n));
  };

  return (
    <Layout>
      <SettingsBtn ref={settingsBtnRef} onClick={() => setShowSettings(true)} title="Настройки" aria-label="Настройки">⚙️</SettingsBtn>
      {showSettings && (
        <SettingsModalOverlay onClick={() => setShowSettings(false)}>
          <SettingsModal ref={settingsModalRef} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Настройки" tabIndex={-1}>
            <h2 style={{margin:'0 0 12px 0'}}>Настройки</h2>
            {/* --- Секция синхронизации --- */}
            <SettingsRow style={{border:'1px solid #e0e7ff',borderRadius:10,padding:'14px 12px',marginBottom:12,background:'#f8fafc'}}>
              <div style={{fontWeight:600, color:'#6366f1', marginBottom:6}}>Синхронизация (WebDAV)</div>
              <input
                type="text"
                placeholder="WebDAV URL (например, https://webdav.yandex.ru)"
                value={webdav.url || ''}
                onChange={e => setWebdav((w:any) => ({...w, url: e.target.value}))}
                style={{marginBottom:6, fontSize:'1em',padding:'6px',borderRadius:6,border:'1.2px solid #ddd'}}
              />
              <input
                type="text"
                placeholder="Логин"
                value={webdav.username || ''}
                onChange={e => setWebdav((w:any) => ({...w, username: e.target.value}))}
                style={{marginBottom:6, fontSize:'1em',padding:'6px',borderRadius:6,border:'1.2px solid #ddd'}}
              />
              <input
                type="password"
                placeholder="Пароль"
                value={webdav.password || ''}
                onChange={e => setWebdav((w:any) => ({...w, password: e.target.value}))}
                style={{marginBottom:10, fontSize:'1em',padding:'6px',borderRadius:6,border:'1.2px solid #ddd'}}
              />
              <div style={{display:'flex',gap:10,marginBottom:4}}>
                <button onClick={handleWebdavUpload} style={{background:'#22c55e',color:'#fff',border:'none',borderRadius:8,padding:'7px 18px',fontWeight:600,cursor:'pointer'}}>Выгрузить</button>
                <button onClick={handleWebdavDownload} style={{background:'#6366f1',color:'#fff',border:'none',borderRadius:8,padding:'7px 18px',fontWeight:600,cursor:'pointer'}}>Загрузить</button>
              </div>
              <div style={{fontSize:'0.98em',color:'#888',marginTop:2}}>Данные не передаются третьим лицам. Для Яндекс.Диска используйте <b>https://webdav.yandex.ru</b></div>
            </SettingsRow>
            {/* --- Конец секции синхронизации --- */}
            {/* --- Секция напоминаний --- */}
            <SettingsRow style={{border:'1px solid #fee2e2',borderRadius:10,padding:'14px 12px',marginBottom:12,background:'#fff7ed'}}>
              <div style={{fontWeight:600, color:'#f59e42', marginBottom:6}}>Напоминания</div>
              {notes.filter(n => n.reminder).length === 0 ? (
                <div style={{color:'#aaa'}}>Нет активных напоминаний</div>
              ) : (
                <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:8}}>
                  {notes.filter(n => n.reminder).sort((a,b) => (a.reminder??0)-(b.reminder??0)).map(n => (
                    <li key={n.id} style={{display:'flex',alignItems:'center',gap:10,background:'#fef3c7',borderRadius:8,padding:'6px 12px'}}>
                      <span style={{fontWeight:500}}>{n.title}</span>
                      <span style={{color:'#92400e',fontSize:'0.98em'}}>{n.reminder ? new Date(n.reminder).toLocaleString() : ''}</span>
                      <button onClick={() => exportReminderToIcs(n)} style={{background:'#22c55e',color:'#fff',border:'none',borderRadius:6,padding:'4px 12px',fontWeight:600,cursor:'pointer',fontSize:'0.98em'}}>Добавить в календарь</button>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsRow>
            {/* --- Конец секции напоминаний --- */}
            <SettingsRow>
              <label>Шрифт заметок:</label>
              <select
                value={settings.font}
                onChange={e => setSettings((s: any) => ({ ...s, font: e.target.value }))}
                style={{fontSize:'1.1rem',padding:'6px',borderRadius:6}}
              >
                {fontOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </SettingsRow>
            <SettingsRow>
              <label>Размер шрифта:</label>
              <select
                value={settings.fontSize}
                onChange={e => setSettings((s: any) => ({ ...s, fontSize: e.target.value }))}
                style={{fontSize:'1.1rem',padding:'6px',borderRadius:6}}
              >
                {fontSizeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </SettingsRow>
            <SettingsRow>
              <label>
                <input
                  type="checkbox"
                  checked={settings.autosave}
                  onChange={e => setSettings((s: any) => ({ ...s, autosave: e.target.checked }))}
                  style={{marginRight:8}}
                />
                Автосохранение заметок
              </label>
            </SettingsRow>
            <button
              style={{marginTop:18,fontSize:'1.1rem',padding:'8px 24px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontWeight:600,cursor:'pointer'}}
              onClick={() => setShowSettings(false)}
              aria-label="Закрыть окно настроек"
            >Закрыть</button>
          </SettingsModal>
          {/* Toast уведомление */}
          {syncToast && <div role="status" aria-live="polite" style={{position:'fixed',left:'50%',bottom:40,transform:'translateX(-50%)',background:'#6366f1',color:'#fff',padding:'14px 28px',borderRadius:12,fontSize:'1.08em',fontWeight:600,boxShadow:'0 4px 24px 0 #6366f133',zIndex:3000,opacity:0.97}}>{syncToast}</div>}
        </SettingsModalOverlay>
      )}
      <Sidebar>
        <ExportMenuWrapper>
          <ExportMenuBtn
            aria-haspopup="true"
            aria-expanded={exportMenuOpen}
            aria-label="Экспорт и импорт"
            onClick={() => setExportMenuOpen(v => !v)}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setExportMenuOpen(false); }}
          >
            <IconMenu />
            Экспорт / Импорт
          </ExportMenuBtn>
          {exportMenuOpen && (
            <ExportDropdown tabIndex={-1} role="menu">
              <ExportDropdownItem onClick={handleExportJSON} role="menuitem"><IconExport />Экспорт JSON</ExportDropdownItem>
              <ExportDropdownItem onClick={handleExportAllMarkdown} role="menuitem"><IconMd />Экспорт всех в Markdown</ExportDropdownItem>
              <ExportDropdownItem onClick={handleExportCurrentMarkdown} disabled={!activeNote} role="menuitem"><IconNote />Экспорт заметки в Markdown</ExportDropdownItem>
              <ExportDropdownItem onClick={() => fileInputRef.current?.click()} role="menuitem"><IconImport />Импорт из JSON</ExportDropdownItem>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
            </ExportDropdown>
          )}
        </ExportMenuWrapper>
        <div style={{padding:'0 10px 10px 10px'}}>
          <form onSubmit={e => { e.preventDefault(); handleAddFolder(); }} style={{display:'flex',gap:4,marginBottom:8}}>
            <input
              type="text"
              placeholder="+ папка"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              style={{flex:1,padding:'6px',borderRadius:6,border:'1.2px solid #ddd',fontSize:'1em',height:36}}
              maxLength={24}
            />
            <UniButton type="submit" title="Добавить папку" aria-label="Добавить папку">
              <span style={{fontSize:'1.2em',marginRight:2}}>+</span>
            </UniButton>
          </form>
          {folders.map(folder => (
            <div key={folder.id} style={{marginBottom:6}}>
              <div
                style={{display:'flex',alignItems:'center',gap:6,fontWeight:600,color:'#6366f1',marginBottom:2,background:dropTarget===folder.id?'#e0e7ff':'transparent',borderRadius:6,padding:dropTarget===folder.id?'2px 4px':0,transition:'background 0.15s'}}
                onDragOver={e => { e.preventDefault(); setDropTarget(folder.id); }}
                onDragLeave={e => { if (dropTarget===folder.id) setDropTarget(null); }}
                onDrop={e => {
                  e.preventDefault();
                  if (draggedNoteId) {
                    setNotes(prev => prev.map(n => n.id===draggedNoteId ? { ...n, folderId: folder.id } : n));
                    setDraggedNoteId(null);
                    setDropTarget(null);
                  }
                }}
              >
                <span>📁 {folder.name}</span>
                <UniButton onClick={() => handleDeleteFolder(folder.id)} style={{background:'none',border:'none',color:'#ef4444',fontSize:'1.1em',cursor:'pointer'}}>×</UniButton>
              </div>
              <div style={{marginLeft:18}}>
                {sortedNotes.filter(n => n.folderId === folder.id).length === 0 && (
                  <div style={{color:'#aaa',fontSize:'0.98em',margin:'4px 0'}}>Нет заметок</div>
                )}
                <TransitionGroup component={NotesList}>
                  {sortedNotes.filter(n => n.folderId === folder.id).map(note => (
                    <CSSTransition key={note.id} timeout={320} classNames="note-fade">
                      <NoteItem
                        ref={el => noteRefs.current[note.id] = el}
                        active={note.id === activeId}
                        pinned={note.pinned}
                        onClick={() => setActiveId(note.id)}
                        onDoubleClick={() => handleTitleEdit(note.id)}
                        draggable
                        onDragStart={() => setDraggedNoteId(note.id)}
                        onDragEnd={() => setDraggedNoteId(null)}
                        style={{opacity: draggedNoteId===note.id ? 0.5 : 1, cursor:'grab'}}
                      >
                        {/* Кнопка закрепления */}
                        <span
                          title={note.pinned ? 'Открепить' : 'Закрепить'}
                          onClick={e => { e.stopPropagation(); handleTogglePin(note.id); }}
                          style={{marginRight:6, cursor:'pointer', color: note.pinned ? '#f59e42' : '#bbb', fontSize:'1.2em'}}
                        >📌</span>
                        {editTitleId === note.id ? (
                          <NoteTitleInput
                            ref={titleInputRef}
                            value={note.title}
                            onChange={e => handleTitleChange(e, note.id)}
                            onBlur={() => handleTitleBlur(note.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') titleInputRef.current?.blur();
                            }}
                            maxLength={40}
                            autoFocus
                          />
                        ) : (
                          <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            {highlight(note.title, search)}
                          </span>
                        )}
                        {/* Теги в списке заметок */}
                        <span style={{display:'flex',gap:4,marginLeft:6}}>
                          {note.tags.map(tag => (
                            <span
                              key={tag.name}
                              style={{background:tag.color,color:'#fff',borderRadius:8,padding:'0 7px',fontSize:'0.93em',cursor:'pointer'}}
                              title={`Фильтровать по тегу #${tag.name}`}
                              onClick={e => { e.stopPropagation(); setTagFilter(tag.name); }}
                            >#{tag.name}</span>
                          ))}
                        </span>
                        {/* Напоминание в списке */}
                        {note.reminder && (
                          <span style={{marginLeft:8, color:'#f59e42', fontSize:'0.93em'}} title="Напоминание">
                            ⏰ {formatReminder(note.reminder)}
                          </span>
                        )}
                        {sortedNotes.length > 1 && (
                          <UniButton
                            style={{marginLeft: 8, color: '#ef4444', cursor: 'pointer', fontSize: '1.1em'}}
                            title="Удалить заметку"
                            onClick={e => { e.stopPropagation(); setActiveId(note.id); handleDeleteNote(note.id); }}
                          >🗑️</UniButton>
                        )}
                      </NoteItem>
                    </CSSTransition>
                  ))}
                </TransitionGroup>
              </div>
            </div>
          ))}
          {/* Заметки вне папок */}
          <div
            style={{fontWeight:600,color:'#18181b',margin:'10px 0 2px 0',background:dropTarget==='none'?'#e0e7ff':'transparent',borderRadius:6,padding:dropTarget==='none'?'2px 4px':0,transition:'background 0.15s'}}
            onDragOver={e => { e.preventDefault(); setDropTarget('none'); }}
            onDragLeave={e => { if (dropTarget==='none') setDropTarget(null); }}
            onDrop={e => {
              e.preventDefault();
              if (draggedNoteId) {
                setNotes(prev => prev.map(n => n.id===draggedNoteId ? { ...n, folderId: null } : n));
                setDraggedNoteId(null);
                setDropTarget(null);
              }
            }}
          >Без папки</div>
          <TransitionGroup component={NotesList}>
            {sortedNotes.filter(n => !n.folderId).map(note => (
              <CSSTransition key={note.id} timeout={320} classNames="note-fade">
                <NoteItem
                  ref={el => noteRefs.current[note.id] = el}
                  active={note.id === activeId}
                  pinned={note.pinned}
                  onClick={() => setActiveId(note.id)}
                  onDoubleClick={() => handleTitleEdit(note.id)}
                  draggable
                  onDragStart={() => setDraggedNoteId(note.id)}
                  onDragEnd={() => setDraggedNoteId(null)}
                  style={{opacity: draggedNoteId===note.id ? 0.5 : 1, cursor:'grab'}}
                >
                  {/* Кнопка закрепления */}
                  <span
                    title={note.pinned ? 'Открепить' : 'Закрепить'}
                    onClick={e => { e.stopPropagation(); handleTogglePin(note.id); }}
                    style={{marginRight:6, cursor:'pointer', color: note.pinned ? '#f59e42' : '#bbb', fontSize:'1.2em'}}
                  >📌</span>
                  {editTitleId === note.id ? (
                    <NoteTitleInput
                      ref={titleInputRef}
                      value={note.title}
                      onChange={e => handleTitleChange(e, note.id)}
                      onBlur={() => handleTitleBlur(note.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') titleInputRef.current?.blur();
                      }}
                      maxLength={40}
                      autoFocus
                    />
                  ) : (
                    <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                      {highlight(note.title, search)}
                    </span>
                  )}
                  {/* Теги в списке заметок */}
                  <span style={{display:'flex',gap:4,marginLeft:6}}>
                    {note.tags.map(tag => (
                      <span
                        key={tag.name}
                        style={{background:tag.color,color:'#fff',borderRadius:8,padding:'0 7px',fontSize:'0.93em',cursor:'pointer'}}
                        title={`Фильтровать по тегу #${tag.name}`}
                        onClick={e => { e.stopPropagation(); setTagFilter(tag.name); }}
                      >#{tag.name}</span>
                    ))}
                  </span>
                  {/* Напоминание в списке */}
                  {note.reminder && (
                    <span style={{marginLeft:8, color:'#f59e42', fontSize:'0.93em'}} title="Напоминание">
                      ⏰ {formatReminder(note.reminder)}
                    </span>
                  )}
                  {sortedNotes.length > 1 && (
                    <UniButton
                      style={{marginLeft: 8, color: '#ef4444', cursor: 'pointer', fontSize: '1.1em'}}
                      title="Удалить заметку"
                      onClick={e => { e.stopPropagation(); setActiveId(note.id); handleDeleteNote(note.id); }}
                    >🗑️</UniButton>
                  )}
                </NoteItem>
              </CSSTransition>
            ))}
          </TransitionGroup>
        </div>
        <UniButton onClick={handleAddNote}>+ Новая заметка</UniButton>
        {/* Фильтр по тегу */}
        {tagFilter && (
          <div style={{margin: '0 10px 8px 10px', color: '#6366f1', fontWeight: 500, display:'flex',alignItems:'center',gap:8}}>
            Фильтр по тегу:
            <span style={{background:'#e0e7ff',color:'#3730a3',borderRadius:12,padding:'2px 10px'}}>
              #{tagFilter}
            </span>
            <UniButton onClick={() => setTagFilter(null)} style={{background:'none',border:'none',color:'#a21caf',fontSize:'1.1em',cursor:'pointer'}}>×</UniButton>
          </div>
        )}
        <SearchSortRow>
          <SearchInput
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{fontSize:'1em',padding:'2px 8px',borderRadius:6}}>
            <option value="updated">По дате изменения</option>
            <option value="created">По дате создания</option>
            <option value="title">По алфавиту</option>
            <option value="tag">По тегу</option>
          </select>
        </SearchSortRow>
        {sortedNotes.length === 0 && (
          <EmptyState>
            <EmptyIllustration />
            Нет заметок — создайте первую!
          </EmptyState>
        )}
      </Sidebar>
      <FabBtn onClick={handleAddNote} title="Новая заметка">+</FabBtn>
      <Main>
        {activeNote ? <>
          <Tabs>
            <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>Редактировать</TabButton>
            <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>Просмотр</TabButton>
            <TabButton active={tab === 'support'} onClick={() => setTab('support')}>Поддержать автора</TabButton>
          </Tabs>
          {/* Теги */}
          <TagList>
            {activeNote.tags.map(tag => (
              <Tag key={tag.name} style={{background: tag.color, color: '#fff'}}>
                <span
                  style={{cursor:'pointer'}}
                  title={`Фильтровать по тегу #${tag.name}`}
                  onClick={() => setTagFilter(tag.name)}
                >#{tag.name}</span>
                <TagRemove title="Удалить тег" onClick={() => handleRemoveTag(tag.name)}>&times;</TagRemove>
              </Tag>
            ))}
            <form
              onSubmit={e => { e.preventDefault(); handleAddTag(); }}
              style={{display:'inline'}}
            >
              <TagInput
                type="text"
                placeholder="+ тег"
                value={tagInput}
                onChange={e => setTagInput(e.target.value.replace(/\s/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                maxLength={18}
              />
              <span style={{display:'inline-flex',gap:4,marginLeft:6,verticalAlign:'middle',alignItems:'center'}}>
                <span style={{fontSize:'0.93em',color:'#888',marginRight:4}}>Цвет тега:</span>
                {TAG_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setTagColor(c)} style={{width:14,height:14,borderRadius:'50%',border:tagColor===c?'2px solid #18181b':'1.5px solid #ddd',background:c,margin:0,padding:0,cursor:'pointer',outline:'none',transition:'border 0.15s'}}></button>
                ))}
              </span>
            </form>
          </TagList>
          {/* Напоминание и установка */}
          <div style={{margin:'8px 0 16px 0',display:'flex',alignItems:'center',gap:12}}>
            <label style={{fontWeight:500}}>Напоминание:</label>
            <input
              type="datetime-local"
              value={reminderInput}
              onChange={e => setReminderInput(e.target.value)}
              style={{fontSize:'1rem',padding:'2px 8px',borderRadius:6,border:'1.2px solid #ddd'}}
            />
            <UniButton type="button" onClick={handleSetReminder} style={{padding:'4px 14px'}}>Установить</UniButton>
            {activeNote.reminder && (
              <>
                <span style={{color:'#f59e42',fontSize:'1em'}}>⏰ {formatReminder(activeNote.reminder)}</span>
                <UniButton type="button" onClick={handleRemoveReminder} style={{padding:'4px 14px',background:'#f3f4f6',color:'#a21caf'}}>Удалить</UniButton>
              </>
            )}
          </div>
          {/* Кнопка закрепления в редакторе */}
          <div style={{margin:'0 0 12px 0',display:'flex',alignItems:'center',gap:10}}>
            <UniButton type="button" onClick={() => handleTogglePin(activeNote.id)} style={{padding:'4px 14px',background:activeNote.pinned?'#f59e42':'#e0e7ff',color:activeNote.pinned?'#fff':'#3730a3'}} title={activeNote.pinned ? 'Открепить' : 'Закрепить'} aria-label={activeNote.pinned ? 'Открепить' : 'Закрепить'}>
              📌
            </UniButton>
          </div>
          {tab === 'edit' && <>
            <UndoRedoBar>
              <UndoRedoBtn onClick={handleUndo} disabled={(undoStack[activeNote.id]?.length ?? 0) <= 1} title="Отменить (Ctrl+Z)">↶</UndoRedoBtn>
              <UndoRedoBtn onClick={handleRedo} disabled={(redoStack[activeNote.id]?.length ?? 0) === 0} title="Повторить (Ctrl+Shift+Z или Ctrl+Y)">↷</UndoRedoBtn>
            </UndoRedoBar>
            <FormatBar>
              <FormatBtn title="Жирный (Ctrl+B)" onClick={() => insertAtCursor('**', '**', 'жирный')}><IconBold /></FormatBtn>
              <FormatBtn title="Курсив (Ctrl+I)" onClick={() => insertAtCursor('*', '*', 'курсив')}><IconItalic /></FormatBtn>
              <FormatBtn title="Заголовок" onClick={() => insertAtCursor('# ', '', 'Заголовок')}><IconHeader /></FormatBtn>
              <FormatBtn title="Список" onClick={() => insertAtCursor('- ', '', 'элемент списка')}><IconList /></FormatBtn>
              <FormatBtn title="Ссылка" onClick={() => insertAtCursor('[', '](url)', 'текст')}><IconLink /></FormatBtn>
              <FormatBtn title="Код" onClick={() => insertAtCursor('`', '`', 'код')}><IconInlineCode /></FormatBtn>
              <FormatBtn title="Блок кода" onClick={() => insertAtCursor('```\n', '\n```', 'код')}><IconBlockCode /></FormatBtn>
            </FormatBar>
            <StyledTextarea
              ref={textareaRef}
              value={activeNote.content}
              onChange={handleChange}
              onKeyDown={handleTextareaKeyDown}
              spellCheck={true}
              autoFocus
              style={{fontFamily: settings.font, fontSize: settings.fontSize}}
            />
            <Toolbar>
              <UniButton onClick={handleClear} title="Очистить"><IconClear /></UniButton>
              <UniButton onClick={handleCopy} title="Скопировать"><IconCopy />{copied ? '✓' : ''}</UniButton>
              <UniButton onClick={handlePrint} title="Печать" style={{ background: '#f59e42' }}><IconPrint /></UniButton>
              <UniButton
                onClick={() => handleDeleteNote(activeNote.id)}
                title="Удалить заметку"
                style={{ background: '#ef4444' }}
              >
                <IconDelete />
              </UniButton>
            </Toolbar>
            <Stat>
              <span>Символов: {stats.chars}</span>
              <span>Слов: {stats.words}</span>
              <SaveStatus>
                <SaveIcon saving={saving}>{saving ? '⏳' : '✔️'}</SaveIcon>
                {saving ? 'Сохраняется...' : saved ? 'Сохранено' : 'Не сохранено'}
              </SaveStatus>
            </Stat>
          </>}
          {tab === 'preview' && (
            <MarkdownPreview>
              <ReactMarkdown>{activeNote.content}</ReactMarkdown>
            </MarkdownPreview>
          )}
          {tab === 'support' && (
            <div style={{padding:'32px 0', textAlign:'center', maxWidth:480, margin:'0 auto'}}>
              <div style={{fontSize:'1.25em', marginBottom:24}}>{authorSupport.message}</div>
              <div style={{display:'flex', flexDirection:'column', gap:18, alignItems:'center'}}>
                {authorSupport.methods.map((m, i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12, fontSize:'1.12em', background:'#f3f4f6', borderRadius:10, padding:'12px 22px', minWidth:220}}>
                    <span style={{fontSize:'1.5em'}}>{m.icon}</span>
                    <span style={{fontWeight:600}}>{m.name}</span>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" style={{marginLeft:8, color:'#6366f1', fontWeight:500, textDecoration:'underline'}}>Перейти</a>
                    )}
                    {m.details && (
                      <span style={{marginLeft:8, color:'#18181b', fontWeight:500, letterSpacing:'1px'}}>{m.details}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </> : <div style={{color:'#aaa',fontSize:'1.2rem',marginTop:40}}>Выберите или создайте заметку</div>}
      </Main>
      {showModal && modalType === 'delete' && (
        <ModalOverlay>
          <Modal role="dialog" aria-modal="true" aria-label="Удалить заметку" tabIndex={-1}>
            <h2 style={{color:'#ef4444',marginBottom:12}}>Удалить заметку?</h2>
            <div style={{marginBottom:18, fontSize:'1.08em', color:'#b91c1c', textAlign:'center'}}>
              Вы действительно хотите удалить заметку <b>&quot;{activeNote?.title || 'Без названия'}&quot;</b>? Это действие необратимо.
            </div>
            <ModalActions>
              <UniButton
                onClick={confirmDelete}
                style={{background:'#ef4444',color:'#fff',minWidth:110}}
                aria-label="Удалить заметку"
              >Удалить</UniButton>
              <UniButton
                onClick={cancelModal}
                style={{background:'#f3f4f6',color:'#18181b',minWidth:110}}
                aria-label="Отмена удаления"
              >Отмена</UniButton>
            </ModalActions>
          </Modal>
        </ModalOverlay>
      )}
      {activeNote && (
        <div style={{margin:'8px 0 12px 0',display:'flex',alignItems:'center',gap:10}}>
          <label style={{fontWeight:500,display:'flex',alignItems:'center',gap:4}}><IconFolder />Папка:</label>
          <select
            value={activeNote.folderId || ''}
            onChange={e => setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, folderId: e.target.value || null } : n))}
            style={{fontSize:'1em',padding:'2px 8px',borderRadius:6,border:'1.2px solid #ddd',background:'#f3f4f6',height:36}}
            aria-label="Выбрать папку"
          >
            <option value="">Без папки</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
    </Layout>
  );
}
