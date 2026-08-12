import { useEffect } from 'react';
import { useSettingsStore, type Language } from '@/stores/settingsStore';
import { uiTextPairs } from './translations';

type Pair = readonly [english: string, indonesian: string];

const pairs: Pair[] = uiTextPairs as unknown as Pair[];

const byId = new Map<string, string>();
const byEn = new Map<string, string>();

for (const [en, id] of pairs) {
  byEn.set(en, id);
  byId.set(id, en);
}

const normalise = (value: string) => value.replace(/\s+/g, ' ').trim();

function translateValue(value: string, lang: Language): string | null {
  const raw = normalise(value);
  if (!raw) return null;

  if (lang === 'id') return byEn.get(raw) ?? null;
  return byId.get(raw) ?? null;
}

function translateDynamic(value: string, lang: Language): string | null {
  const raw = normalise(value);

  // Home greeting / XP progress contain user data, so they cannot be stored as
  // fixed dictionary entries.
  const idGreeting = raw.match(/^Halo, (.+) 👋$/);
  const enGreeting = raw.match(/^Hello, (.+) 👋$/);
  if (lang === 'en' && idGreeting) return `Hello, ${idGreeting[1]} 👋`;
  if (lang === 'id' && enGreeting) return `Halo, ${enGreeting[1]} 👋`;

  const idXp = raw.match(/^(\d+) \/ (\d+) XP to Level (\d+)$/);
  const enXp = raw.match(/^(\d+) \/ (\d+) XP ke Tingkat (\d+)$/);
  if (lang === 'id' && idXp) return `${idXp[1]} / ${idXp[2]} XP ke Tingkat ${idXp[3]}`;
  if (lang === 'en' && enXp) return `${enXp[1]} / ${enXp[2]} XP to Level ${enXp[3]}`;

  return null;
}

function shouldSkipTextNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName.toLowerCase();
  return ['script', 'style', 'textarea', 'code', 'pre'].includes(tag);
}

function localizeDocument(lang: Language) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null = null;

  while ((current = walker.nextNode())) {
    if (!shouldSkipTextNode(current)) nodes.push(current as Text);
  }

  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    const translated = translateValue(text, lang) ?? translateDynamic(text, lang);
    if (translated && translated !== text.trim()) {
      // Keep intentional leading/trailing whitespace from JSX text nodes.
      const leading = text.match(/^\s*/)?.[0] ?? '';
      const trailing = text.match(/\s*$/)?.[0] ?? '';
      node.nodeValue = `${leading}${translated}${trailing}`;
    }
  }

  const attributes = ['title', 'placeholder', 'aria-label', 'aria-description'];
  for (const attr of attributes) {
    document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
      const value = el.getAttribute(attr);
      if (!value) return;
      const translated = translateValue(value, lang) ?? translateDynamic(value, lang);
      if (translated) el.setAttribute(attr, translated);
    });
  }
}

/**
 * Legacy UI localization bridge.
 *
 * Existing screens contain a large amount of literal JSX text. This component
 * watches the rendered UI and maps those known labels to the active language,
 * so Language=ID/EN is consistent even on screens that do not yet import useT.
 */
export function DomLocalization() {
  const language = useSettingsStore((s) => s.language);

  useEffect(() => {
    let applying = false;

    const apply = () => {
      if (applying) return;
      applying = true;
      observer.disconnect();
      localizeDocument(language);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      applying = false;
    };

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    apply();

    return () => observer.disconnect();
  }, [language]);

  return null;
}
