import React, { useState, useRef, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Notebook } from './Notebook';
import { authorSupport } from './authorSupport';
import { QRCodeCanvas } from 'qrcode.react';
import { themes } from '../styles/theme';

const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 32px 16px 16px 16px;
  background: ${({ theme }) => theme.colors.background};
`;

const CenteredContainer = styled.div`
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.accent};
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 24px;
  letter-spacing: -1px;
  text-align: center;
`;

const MainActions = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
`;

const MainBtn = styled.button`
  background: ${({ theme }) => theme.colors.accent};
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 28px;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
  will-change: transform;
  &:hover {
    background: #4f46e5;
    box-shadow: 0 4px 16px 0 rgba(99,102,241,0.18);
    transform: translateY(-2px) scale(1.04);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(99,102,241,0.10);
  }
`;

const ThemeButton = styled.button`
  position: absolute;
  top: 24px;
  right: 32px;
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

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(245,158,66,0.18), 0 2px 8px 0 rgba(245,158,66,0.10); transform: scale(1); }
  60% { box-shadow: 0 0 0 12px rgba(245,158,66,0.08), 0 4px 16px 0 rgba(245,158,66,0.18); transform: scale(1.045); }
  100% { box-shadow: 0 0 0 0 rgba(245,158,66,0.18), 0 2px 8px 0 rgba(245,158,66,0.10); transform: scale(1); }
`;

const SupportBtn = styled.button`
  background: #f59e42;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 28px;
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 auto 24px auto;
  display: block;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(245,158,66,0.10);
  transition: background 0.18s, box-shadow 0.18s, transform 0.12s;
  will-change: transform;
  animation: ${pulse} 1.8s infinite cubic-bezier(.4,0,.2,1);
  &:hover {
    background: #ef4444;
    box-shadow: 0 4px 16px 0 rgba(245,158,66,0.18);
    transform: translateY(-2px) scale(1.04);
  }
  &:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px 0 rgba(245,158,66,0.10);
  }
`;

const AboutBtn = styled(SupportBtn)`
  background: #6366f1;
  margin-top: 0;
  margin-bottom: 18px;
  &:hover { background: #4f46e5; }
`;

const SupportModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const SupportModal = styled.div`
  background: #fff;
  color: #18181b;
  border-radius: 16px;
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.18);
  padding: 36px 32px 28px 32px;
  min-width: 320px;
  max-width: 96vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
`;

const SupportCloseBtn = styled.button`
  background: #f3f4f6;
  color: #18181b;
  border: none;
  border-radius: 8px;
  padding: 8px 24px;
  font-size: 1.08rem;
  font-weight: 600;
  margin-top: 18px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover { background: #e0e7ff; color: #3730a3; }
`;

const ShareBtn = styled(SupportBtn)`
  background: #22c55e;
  margin-left: 0;
  margin-top: 10px;
  &:hover { background: #16a34a; }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
`;

const QRWrapper = styled.div`
  margin-top: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 20px 20px 10px 20px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.07);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${fadeInScale} 0.32s cubic-bezier(.4,0,.2,1);
  @media (max-width: 600px) {
    padding: 14px 2vw 8px 2vw;
    width: 96vw;
    box-sizing: border-box;
  }
`;

const DonateBtn = styled.button`
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 1.08em;
  font-weight: 600;
  margin-left: 10px;
  cursor: pointer;
  transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
  will-change: transform;
  &:hover { background: #4f46e5; transform: scale(1.06); box-shadow: 0 2px 8px 0 #6366f133; }
  &:active { transform: scale(0.95); }
  @media (max-width: 600px) {
    width: 100%;
    margin: 8px 0 0 0;
    padding: 10px 0;
    font-size: 1.12em;
  }
`;

const QRBtn = styled(DonateBtn)`
  background: #f59e42;
  &:hover { background: #ef4444; }
`;

const Toast = styled.div`
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  background: #6366f1;
  color: #fff;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 1.12em;
  font-weight: 600;
  box-shadow: 0 4px 24px 0 rgba(99,102,241,0.18);
  z-index: 3000;
  opacity: 0.97;
  animation: fadeIn 0.3s;
`;

type AppProps = {
  toggleTheme: () => void;
  themeMode: 'light' | 'dark' | 'color';
  setTheme: (t: 'light' | 'dark' | 'color') => void;
  themeKey: 'light' | 'dark' | 'color';
};

export default function App({ toggleTheme, themeMode, setTheme, themeKey }: AppProps) {
  const [showSupport, setShowSupport] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number|null>(null);
  const [qrShownIdx, setQrShownIdx] = useState<number|null>(null);
  const [showDetailsIdx, setShowDetailsIdx] = useState<number|null>(null);
  const [showThanks, setShowThanks] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const supportBtnRef = useRef<HTMLButtonElement>(null);
  const aboutBtnRef = useRef<HTMLButtonElement>(null);
  const supportModalRef = useRef<HTMLDivElement>(null);
  const aboutModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function trapFocus(e: KeyboardEvent) {
      const modal = showSupport ? supportModalRef.current : showAbout ? aboutModalRef.current : null;
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
    if (showSupport || showAbout) {
      document.addEventListener('keydown', trapFocus);
      setTimeout(() => {
        const modal = showSupport ? supportModalRef.current : showAbout ? aboutModalRef.current : null;
        if (modal) {
          const focusable = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length) focusable[0].focus();
        }
      }, 0);
    }
    return () => document.removeEventListener('keydown', trapFocus);
  }, [showSupport, showAbout]);

  useEffect(() => {
    if (!showSupport && supportBtnRef.current) supportBtnRef.current.focus();
  }, [showSupport]);
  useEffect(() => {
    if (!showAbout && aboutBtnRef.current) aboutBtnRef.current.focus();
  }, [showAbout]);

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setShowThanks(true);
      setTimeout(() => setCopiedIdx(null), 1200);
      setTimeout(() => setShowThanks(false), 2000);
    } catch {
      // intentionally empty: ignore clipboard errors
    }
  };
  const handleToggleQR = (idx: number) => {
    setQrShownIdx(qrShownIdx === idx ? null : idx);
  };
  const handleToggleDetails = (idx: number) => {
    setShowDetailsIdx(showDetailsIdx === idx ? null : idx);
  };
  const handleThanks = () => {
    setShowThanks(true);
    setTimeout(() => setShowThanks(false), 2000);
  };
  const handleShare = async () => {
    const shareData = {
      title: document.title,
      text: 'Попробуйте современный онлайн-блокнот!',
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShowThanks(true);
        setTimeout(() => setShowThanks(false), 2000);
      } catch {
        // intentionally empty: ignore share errors
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShowShare(true);
        setTimeout(() => setShowShare(false), 2000);
      } catch {
        // intentionally empty: ignore clipboard errors
      }
    }
  };
  return (
    <Wrapper>
      <ThemeButton onClick={toggleTheme} title="Переключить тему" aria-label="Переключить тему">
        {themeMode === 'light' ? '🌙' : themeMode === 'dark' ? '🎨' : '☀️'}
      </ThemeButton>
      <CenteredContainer>
        <Title>Онлайн-блокнот</Title>
        <MainActions>
          <MainBtn ref={supportBtnRef} onClick={() => setShowSupport(true)} aria-label="Поддержать автора">Поддержать автора</MainBtn>
          <MainBtn as="button" ref={aboutBtnRef} onClick={() => setShowAbout(true)} aria-label="О проекте" style={{background:'#6366f1'}}>
            О проекте
          </MainBtn>
          {/* Здесь будет компактное меню экспорта/импорта */}
        </MainActions>
        {showSupport && (
          <SupportModalOverlay onClick={() => setShowSupport(false)}>
            <SupportModal ref={supportModalRef} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Поддержать автора" tabIndex={-1}>
              <div style={{fontSize:'1.22em', marginBottom:10, textAlign:'center'}}>{authorSupport.message}</div>
              {authorSupport.purpose && (
                <div style={{fontSize:'1.08em', color:'#888', fontStyle:'italic', marginBottom:10, textAlign:'center'}}>{authorSupport.purpose}</div>
              )}
              {authorSupport.stats && authorSupport.stats.supporters && (
                <div style={{fontSize:'1.08em', color:'#22c55e', fontWeight:600, marginBottom:18, textAlign:'center'}}>
                  Проект поддержали уже {authorSupport.stats.supporters} человек!
                </div>
              )}
              <div style={{display:'flex', flexDirection:'column', gap:16, alignItems:'center'}}>
                {authorSupport.methods.map((m, i) => {
                  const qrValue = m.details || m.url;
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:12, fontSize:'1.12em', background:'#f3f4f6', borderRadius:10, padding:'12px 22px', minWidth:220, flexDirection:'column'}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{fontSize:'1.5em'}}>{m.icon}</span>
                        <span style={{fontWeight:600}}>{m.name}</span>
                        {m.url && (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{marginLeft:8, color:'#6366f1', fontWeight:500, textDecoration:'underline'}} 
                            onClick={handleThanks}
                          >Перейти</a>
                        )}
                        {m.details && (
                          <>
                            {showDetailsIdx === i ? (
                              <>
                                <span style={{marginLeft:8, color:'#18181b', fontWeight:500, letterSpacing:'1px'}}>{m.details}</span>
                                <DonateBtn onClick={() => handleCopy(m.details!, i)}>
                                  {copiedIdx === i ? 'Скопировано!' : 'Скопировать'}
                                </DonateBtn>
                                <DonateBtn onClick={() => handleToggleDetails(i)} style={{background:'#f3f4f6',color:'#6366f1',marginLeft:10}}>
                                  Скрыть
                                </DonateBtn>
                              </>
                            ) : (
                              <DonateBtn onClick={() => handleToggleDetails(i)}>
                                Показать
                              </DonateBtn>
                            )}
                          </>
                        )}
                        {qrValue && (
                          <QRBtn onClick={() => handleToggleQR(i)}>
                            {qrShownIdx === i ? 'Скрыть QR' : 'Показать QR'}
                          </QRBtn>
                        )}
                      </div>
                      {qrShownIdx === i && qrValue && (
                        <QRWrapper>
                          <QRCodeCanvas
                            value={qrValue}
                            size={200}
                            level="H"
                            includeMargin={true}
                            bgColor="#fff"
                            fgColor="#18181b"
                          />
                          <div style={{marginTop:10, color:'#6366f1', fontWeight:500, fontSize:'1.04em', textAlign:'center'}}>Отсканируйте QR-код для быстрого перевода</div>
                        </QRWrapper>
                      )}
                    </div>
                  );
                })}
              </div>
              <ShareBtn onClick={handleShare}>Поделиться</ShareBtn>
              <SupportCloseBtn onClick={() => setShowSupport(false)} aria-label="Закрыть окно поддержки">Закрыть</SupportCloseBtn>
              {authorSupport.signature && (
                <div style={{marginTop:18, color:'#888', fontSize:'1.08em', fontStyle:'italic'}}>{authorSupport.signature}</div>
              )}
              {authorSupport.socials && authorSupport.socials.length > 0 && (
                <div style={{marginTop:10, display:'flex', gap:18, justifyContent:'center', alignItems:'center'}}>
                  {authorSupport.socials.map((s, idx) => (
                    <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" style={{color:'#6366f1', fontWeight:500, fontSize:'1.18em', textDecoration:'none', display:'flex',alignItems:'center',gap:6}}>
                      {s.icon && s.icon.startsWith('<svg') ? (
                        <span aria-label={s.name} style={{display:'flex',alignItems:'center'}} dangerouslySetInnerHTML={{__html: s.icon}} />
                      ) : (
                        <span>{s.icon}</span>
                      )}
                      {s.name}
                    </a>
                  ))}
                </div>
              )}
            </SupportModal>
          </SupportModalOverlay>
        )}
        {showAbout && (
          <SupportModalOverlay onClick={() => setShowAbout(false)}>
            <SupportModal ref={aboutModalRef} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="О проекте" tabIndex={-1}>
              <div style={{fontSize:'1.32em', fontWeight:700, marginBottom:10, color:'#6366f1'}}>О проекте</div>
              <div style={{fontSize:'1.12em', marginBottom:16, textAlign:'center'}}>
                {authorSupport.message}
              </div>
              <div style={{fontSize:'1.05em', color:'#888', marginBottom:18, textAlign:'center'}}>
                Этот онлайн-блокнот создан для удобного хранения, поиска и форматирования заметок. Все данные хранятся только у вас в браузере. Приложение поддерживает мультизаметки, Markdown, экспорт/импорт, PWA, напоминания, теги, undo/redo, адаптивность и многое другое.
              </div>
              <div style={{marginBottom:18, color:'#6366f1', fontWeight:500, fontSize:'1.08em', textAlign:'center'}}>
                Технологии: React, TypeScript, styled-components, PWA, LocalStorage
              </div>
              {authorSupport.signature && (
                <div style={{marginBottom:10, color:'#888', fontSize:'1.08em', fontStyle:'italic'}}>{authorSupport.signature}</div>
              )}
              {authorSupport.socials && authorSupport.socials.length > 0 && (
                <div style={{marginTop:6, display:'flex', gap:18, justifyContent:'center', alignItems:'center'}}>
                  {authorSupport.socials.map((s, idx) => (
                    <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" style={{color:'#6366f1', fontWeight:500, fontSize:'1.18em', textDecoration:'none', display:'flex',alignItems:'center',gap:6}}>
                      {s.icon && s.icon.startsWith('<svg') ? (
                        <span aria-label={s.name} style={{display:'flex',alignItems:'center'}} dangerouslySetInnerHTML={{__html: s.icon}} />
                      ) : (
                        <span>{s.icon}</span>
                      )}
                      {s.name}
                    </a>
                  ))}
                </div>
              )}
              <SupportCloseBtn onClick={() => setShowAbout(false)} aria-label="Закрыть окно о проекте">Закрыть</SupportCloseBtn>
            </SupportModal>
          </SupportModalOverlay>
        )}
        {showSettings && (
          <SupportModalOverlay onClick={() => setShowSettings(false)}>
            <SupportModal onClick={e => e.stopPropagation()}>
              <div style={{fontSize:'1.22em', marginBottom:10, textAlign:'center'}}>Настройки</div>
              <div style={{marginBottom:14}}>
                <label style={{fontWeight:600,marginRight:8}}>Тема оформления:</label>
                <select
                  value={themeKey}
                  onChange={e => setTheme(e.target.value as any)}
                  style={{fontSize:'1.08em',padding:'6px',borderRadius:6,border:'1.2px solid #ddd'}}
                >
                  {themes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <SupportCloseBtn onClick={() => setShowSettings(false)}>Закрыть</SupportCloseBtn>
            </SupportModal>
          </SupportModalOverlay>
        )}
        <Notebook />
        {showThanks && <Toast>Спасибо за поддержку!</Toast>}
        {showShare && <Toast>Ссылка скопирована!</Toast>}
      </CenteredContainer>
    </Wrapper>
  );
} 