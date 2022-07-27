import '../wydr';

import React from 'react';

import { Client as Styletron } from 'styletron-engine-monolithic';
import { BaseProvider, createTheme } from 'baseui';
import { Provider as StyletronProvider } from 'styletron-react';

import type { StandardEngine } from 'styletron-react';

import { HashRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const container = document.getElementById('root') as HTMLDivElement;
const root = createRoot(container);

type FixedStyletronProviderType = React.Provider<StandardEngine> & {
  children: React.ReactNode;
};

const FixedStyletronProvider = StyletronProvider as FixedStyletronProviderType;

const engine = new Styletron();

const CustomizedTheme = createTheme(
  {
    primaryFontFamily: 'Raleway, Noto Color Emoji',
  },
  {
    borders: {
      useRoundedCorners: false,
      radius100: '0px',
      radius200: '0px',
      radius300: '0px',
      radius400: '0px',
      radius500: '0px',
      buttonBorderRadius: '0px',
    },
    typography: {
      DisplayLarge: {
        fontFamily: 'Raleway',
      },
      DisplayMedium: {
        fontFamily: 'Raleway',
      },
      DisplaySmall: {
        fontFamily: 'Raleway',
      },
      DisplayXSmall: {
        fontFamily: 'Raleway',
      },
    },
  }
);

root.render(
  <FixedStyletronProvider value={engine}>
    <BaseProvider theme={CustomizedTheme}>
      <HashRouter>
        <App />
      </HashRouter>
    </BaseProvider>
  </FixedStyletronProvider>
);
