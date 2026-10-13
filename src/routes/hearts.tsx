import { createFileRoute } from '@tanstack/react-router';
import { createGlobalStyle } from 'styled-components';
import { HeartsApp } from '../features/hearts/components/HeartsApp';

const GlobalHeartsStyle = createGlobalStyle`
  body {
    background-color: #0d5c2e;
  }
`;

export const Route = createFileRoute('/hearts')({
  component: HeartsPage,
  head: () => ({
    meta: [
      { title: 'Hearts' },
      { name: 'description', content: 'The classic card game' },
      { name: 'theme-color', content: '#0d5c2e' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Hearts' },
    ],
    links: [
      { rel: 'icon', sizes: '32x32', href: '/favicons/hearts/favicon-32.png' },
      { rel: 'icon', sizes: 'any', href: '/favicons/hearts/favicon.ico' },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/favicons/hearts/apple-touch-icon.png',
      },
      { rel: 'manifest', href: '/favicons/hearts/site.webmanifest' },
    ],
  }),
});

function HeartsPage() {
  return (
    <>
      <GlobalHeartsStyle />
      <HeartsApp />
    </>
  );
}
