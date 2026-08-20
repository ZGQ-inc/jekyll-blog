const THEMES = {
  blue: {
    name: '海洋蓝', emoji: '🔵', seed: '#0061A4',
    light: {
      '--md-sys-color-primary': '#0061A4',
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': '#D1E4FF',
      '--md-sys-color-on-primary-container': '#001D36',
      '--md-sys-color-secondary': '#535F70',
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': '#D7E3F7',
      '--md-sys-color-on-secondary-container': '#101C2B',
      '--md-sys-color-tertiary': '#6B5778',
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': '#F2DAFF',
      '--md-sys-color-on-tertiary-container': '#251431',
      '--md-sys-color-error': '#BA1A1A',
      '--md-sys-color-on-error': '#FFFFFF',
      '--md-sys-color-error-container': '#FFDAD6',
      '--md-sys-color-on-error-container': '#410002',
      '--md-sys-color-background': '#FDFCFF',
      '--md-sys-color-on-background': '#1A1C1E',
      '--md-sys-color-surface': '#FDFCFF',
      '--md-sys-color-on-surface': '#1A1C1E',
      '--md-sys-color-surface-variant': '#DFE2EB',
      '--md-sys-color-on-surface-variant': '#43474E',
      '--md-sys-color-outline': '#73777F',
      '--md-sys-color-outline-variant': '#C3C7CF',
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': '#F3F3F7',
      '--md-sys-color-surface-container': '#EDEDF1',
      '--md-sys-color-surface-container-high': '#E7E8EC',
      '--md-sys-color-surface-container-highest': '#E2E2E6',
      '--md-sys-color-inverse-surface': '#2F3033',
      '--md-sys-color-inverse-on-surface': '#F1F0F4',
      '--md-sys-color-inverse-primary': '#9ECAFF',
    },
    dark: {
      '--md-sys-color-primary': '#9ECAFF',
      '--md-sys-color-on-primary': '#003258',
      '--md-sys-color-primary-container': '#00497D',
      '--md-sys-color-on-primary-container': '#D1E4FF',
      '--md-sys-color-secondary': '#BBC7DB',
      '--md-sys-color-on-secondary': '#253140',
      '--md-sys-color-secondary-container': '#3B4858',
      '--md-sys-color-on-secondary-container': '#D7E3F7',
      '--md-sys-color-tertiary': '#D6BEE4',
      '--md-sys-color-on-tertiary': '#3B2948',
      '--md-sys-color-tertiary-container': '#523F60',
      '--md-sys-color-on-tertiary-container': '#F2DAFF',
      '--md-sys-color-error': '#FFB4AB',
      '--md-sys-color-on-error': '#690005',
      '--md-sys-color-error-container': '#93000A',
      '--md-sys-color-on-error-container': '#FFDAD6',
      '--md-sys-color-background': '#1A1C1E',
      '--md-sys-color-on-background': '#E2E2E6',
      '--md-sys-color-surface': '#1A1C1E',
      '--md-sys-color-on-surface': '#E2E2E6',
      '--md-sys-color-surface-variant': '#43474E',
      '--md-sys-color-on-surface-variant': '#C3C7CF',
      '--md-sys-color-outline': '#8D9199',
      '--md-sys-color-outline-variant': '#43474E',
      '--md-sys-color-surface-container-lowest': '#0F1113',
      '--md-sys-color-surface-container-low': '#1C1E20',
      '--md-sys-color-surface-container': '#202224',
      '--md-sys-color-surface-container-high': '#2B2D30',
      '--md-sys-color-surface-container-highest': '#35373A',
      '--md-sys-color-inverse-surface': '#E2E2E6',
      '--md-sys-color-inverse-on-surface': '#2F3033',
      '--md-sys-color-inverse-primary': '#0061A4',
    }
  },
  purple: {
    name: '紫色梦境', emoji: '💜', seed: '#6750A4',
    light: {
      '--md-sys-color-primary': '#6750A4',
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': '#EADDFF',
      '--md-sys-color-on-primary-container': '#21005D',
      '--md-sys-color-secondary': '#625B71',
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': '#E8DEF8',
      '--md-sys-color-on-secondary-container': '#1D192B',
      '--md-sys-color-tertiary': '#7D5260',
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': '#FFD8E4',
      '--md-sys-color-on-tertiary-container': '#31111D',
      '--md-sys-color-error': '#B3261E',
      '--md-sys-color-on-error': '#FFFFFF',
      '--md-sys-color-error-container': '#F9DEDC',
      '--md-sys-color-on-error-container': '#410E0B',
      '--md-sys-color-background': '#FFFBFE',
      '--md-sys-color-on-background': '#1C1B1F',
      '--md-sys-color-surface': '#FFFBFE',
      '--md-sys-color-on-surface': '#1C1B1F',
      '--md-sys-color-surface-variant': '#E7E0EC',
      '--md-sys-color-on-surface-variant': '#49454F',
      '--md-sys-color-outline': '#79747E',
      '--md-sys-color-outline-variant': '#CAC4D0',
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': '#F7F2FA',
      '--md-sys-color-surface-container': '#F3EDF7',
      '--md-sys-color-surface-container-high': '#ECE6F0',
      '--md-sys-color-surface-container-highest': '#E6E0E9',
      '--md-sys-color-inverse-surface': '#313033',
      '--md-sys-color-inverse-on-surface': '#F4EFF4',
      '--md-sys-color-inverse-primary': '#D0BCFF',
    },
    dark: {
      '--md-sys-color-primary': '#D0BCFF',
      '--md-sys-color-on-primary': '#381E72',
      '--md-sys-color-primary-container': '#4F378B',
      '--md-sys-color-on-primary-container': '#EADDFF',
      '--md-sys-color-secondary': '#CCC2DC',
      '--md-sys-color-on-secondary': '#332D41',
      '--md-sys-color-secondary-container': '#4A4458',
      '--md-sys-color-on-secondary-container': '#E8DEF8',
      '--md-sys-color-tertiary': '#EFB8C8',
      '--md-sys-color-on-tertiary': '#492532',
      '--md-sys-color-tertiary-container': '#633B48',
      '--md-sys-color-on-tertiary-container': '#FFD8E4',
      '--md-sys-color-error': '#F2B8B5',
      '--md-sys-color-on-error': '#601410',
      '--md-sys-color-error-container': '#8C1D18',
      '--md-sys-color-on-error-container': '#F9DEDC',
      '--md-sys-color-background': '#1C1B1F',
      '--md-sys-color-on-background': '#E6E1E5',
      '--md-sys-color-surface': '#1C1B1F',
      '--md-sys-color-on-surface': '#E6E1E5',
      '--md-sys-color-surface-variant': '#49454F',
      '--md-sys-color-on-surface-variant': '#CAC4D0',
      '--md-sys-color-outline': '#938F99',
      '--md-sys-color-outline-variant': '#49454F',
      '--md-sys-color-surface-container-lowest': '#0F0D13',
      '--md-sys-color-surface-container-low': '#1D1B20',
      '--md-sys-color-surface-container': '#211F26',
      '--md-sys-color-surface-container-high': '#2B2930',
      '--md-sys-color-surface-container-highest': '#36343B',
      '--md-sys-color-inverse-surface': '#E6E1E5',
      '--md-sys-color-inverse-on-surface': '#313033',
      '--md-sys-color-inverse-primary': '#6750A4',
    }
  },
  green: {
    name: '森林绿意', emoji: '🌿', seed: '#006E2C',
    light: {
      '--md-sys-color-primary': '#006E2C',
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': '#97F5AA',
      '--md-sys-color-on-primary-container': '#002109',
      '--md-sys-color-secondary': '#516350',
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': '#D3E8CF',
      '--md-sys-color-on-secondary-container': '#0F1F10',
      '--md-sys-color-tertiary': '#39656B',
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': '#BCEBF1',
      '--md-sys-color-on-tertiary-container': '#001F23',
      '--md-sys-color-error': '#BA1A1A',
      '--md-sys-color-on-error': '#FFFFFF',
      '--md-sys-color-error-container': '#FFDAD6',
      '--md-sys-color-on-error-container': '#410002',
      '--md-sys-color-background': '#FDFDF6',
      '--md-sys-color-on-background': '#1A1C19',
      '--md-sys-color-surface': '#FDFDF6',
      '--md-sys-color-on-surface': '#1A1C19',
      '--md-sys-color-surface-variant': '#DEE5D9',
      '--md-sys-color-on-surface-variant': '#424940',
      '--md-sys-color-outline': '#72796F',
      '--md-sys-color-outline-variant': '#C2C9BD',
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': '#F3F4ED',
      '--md-sys-color-surface-container': '#EDEEE7',
      '--md-sys-color-surface-container-high': '#E7E9E1',
      '--md-sys-color-surface-container-highest': '#E2E3DB',
      '--md-sys-color-inverse-surface': '#2E312D',
      '--md-sys-color-inverse-on-surface': '#F0F2EA',
      '--md-sys-color-inverse-primary': '#7BD88D',
    },
    dark: {
      '--md-sys-color-primary': '#7BD88D',
      '--md-sys-color-on-primary': '#003914',
      '--md-sys-color-primary-container': '#005220',
      '--md-sys-color-on-primary-container': '#97F5AA',
      '--md-sys-color-secondary': '#B8CCB4',
      '--md-sys-color-on-secondary': '#233424',
      '--md-sys-color-secondary-container': '#394B39',
      '--md-sys-color-on-secondary-container': '#D3E8CF',
      '--md-sys-color-tertiary': '#A0CFD6',
      '--md-sys-color-on-tertiary': '#00363C',
      '--md-sys-color-tertiary-container': '#1F4D53',
      '--md-sys-color-on-tertiary-container': '#BCEBF1',
      '--md-sys-color-error': '#FFB4AB',
      '--md-sys-color-on-error': '#690005',
      '--md-sys-color-error-container': '#93000A',
      '--md-sys-color-on-error-container': '#FFDAD6',
      '--md-sys-color-background': '#1A1C19',
      '--md-sys-color-on-background': '#E2E3DB',
      '--md-sys-color-surface': '#1A1C19',
      '--md-sys-color-on-surface': '#E2E3DB',
      '--md-sys-color-surface-variant': '#424940',
      '--md-sys-color-on-surface-variant': '#C2C9BD',
      '--md-sys-color-outline': '#8C9389',
      '--md-sys-color-outline-variant': '#424940',
      '--md-sys-color-surface-container-lowest': '#0E110E',
      '--md-sys-color-surface-container-low': '#1A1C19',
      '--md-sys-color-surface-container': '#1E211D',
      '--md-sys-color-surface-container-high': '#282B27',
      '--md-sys-color-surface-container-highest': '#333631',
      '--md-sys-color-inverse-surface': '#E2E3DB',
      '--md-sys-color-inverse-on-surface': '#2E312D',
      '--md-sys-color-inverse-primary': '#006E2C',
    }
  },
  orange: {
    name: '秋日橙光', emoji: '🍊', seed: '#9D4000',
    light: {
      '--md-sys-color-primary': '#9D4000',
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': '#FFDBCA',
      '--md-sys-color-on-primary-container': '#341000',
      '--md-sys-color-secondary': '#77574A',
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': '#FFDBD0',
      '--md-sys-color-on-secondary-container': '#2C160C',
      '--md-sys-color-tertiary': '#666022',
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': '#EEE59B',
      '--md-sys-color-on-tertiary-container': '#1E1C00',
      '--md-sys-color-error': '#BA1A1A',
      '--md-sys-color-on-error': '#FFFFFF',
      '--md-sys-color-error-container': '#FFDAD6',
      '--md-sys-color-on-error-container': '#410002',
      '--md-sys-color-background': '#FFFBFF',
      '--md-sys-color-on-background': '#201A17',
      '--md-sys-color-surface': '#FFFBFF',
      '--md-sys-color-on-surface': '#201A17',
      '--md-sys-color-surface-variant': '#F5DED6',
      '--md-sys-color-on-surface-variant': '#53433D',
      '--md-sys-color-outline': '#85736D',
      '--md-sys-color-outline-variant': '#D8C2BB',
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': '#FBF1ED',
      '--md-sys-color-surface-container': '#F5EBE7',
      '--md-sys-color-surface-container-high': '#EFE5E1',
      '--md-sys-color-surface-container-highest': '#E9DFDB',
      '--md-sys-color-inverse-surface': '#362F2C',
      '--md-sys-color-inverse-on-surface': '#FBEEEA',
      '--md-sys-color-inverse-primary': '#FFB68D',
    },
    dark: {
      '--md-sys-color-primary': '#FFB68D',
      '--md-sys-color-on-primary': '#551A00',
      '--md-sys-color-primary-container': '#7A2F00',
      '--md-sys-color-on-primary-container': '#FFDBCA',
      '--md-sys-color-secondary': '#E7BDB1',
      '--md-sys-color-on-secondary': '#442A20',
      '--md-sys-color-secondary-container': '#5D4035',
      '--md-sys-color-on-secondary-container': '#FFDBD0',
      '--md-sys-color-tertiary': '#D2C97F',
      '--md-sys-color-on-tertiary': '#343200',
      '--md-sys-color-tertiary-container': '#4C4900',
      '--md-sys-color-on-tertiary-container': '#EEE59B',
      '--md-sys-color-error': '#FFB4AB',
      '--md-sys-color-on-error': '#690005',
      '--md-sys-color-error-container': '#93000A',
      '--md-sys-color-on-error-container': '#FFDAD6',
      '--md-sys-color-background': '#201A17',
      '--md-sys-color-on-background': '#EDE0DB',
      '--md-sys-color-surface': '#201A17',
      '--md-sys-color-on-surface': '#EDE0DB',
      '--md-sys-color-surface-variant': '#53433D',
      '--md-sys-color-on-surface-variant': '#D8C2BB',
      '--md-sys-color-outline': '#A08D87',
      '--md-sys-color-outline-variant': '#53433D',
      '--md-sys-color-surface-container-lowest': '#140E0B',
      '--md-sys-color-surface-container-low': '#201A17',
      '--md-sys-color-surface-container': '#251E1B',
      '--md-sys-color-surface-container-high': '#2F2825',
      '--md-sys-color-surface-container-highest': '#3B332F',
      '--md-sys-color-inverse-surface': '#EDE0DB',
      '--md-sys-color-inverse-on-surface': '#362F2C',
      '--md-sys-color-inverse-primary': '#9D4000',
    }
  },
  rose: {
    name: '玫瑰红', emoji: '🌹', seed: '#B3261E',
    light: {
      '--md-sys-color-primary': '#B3261E',
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': '#FFDAD6',
      '--md-sys-color-on-primary-container': '#410002',
      '--md-sys-color-secondary': '#775652',
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': '#FFDAD6',
      '--md-sys-color-on-secondary-container': '#2C1512',
      '--md-sys-color-tertiary': '#715B2E',
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': '#FDDFA6',
      '--md-sys-color-on-tertiary-container': '#261900',
      '--md-sys-color-error': '#B3261E',
      '--md-sys-color-on-error': '#FFFFFF',
      '--md-sys-color-error-container': '#FFDAD6',
      '--md-sys-color-on-error-container': '#410002',
      '--md-sys-color-background': '#FFFBFF',
      '--md-sys-color-on-background': '#201A1A',
      '--md-sys-color-surface': '#FFFBFF',
      '--md-sys-color-on-surface': '#201A1A',
      '--md-sys-color-surface-variant': '#F5DDDB',
      '--md-sys-color-on-surface-variant': '#534341',
      '--md-sys-color-outline': '#857370',
      '--md-sys-color-outline-variant': '#D8C2BF',
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': '#FBF0EF',
      '--md-sys-color-surface-container': '#F5EAEA',
      '--md-sys-color-surface-container-high': '#EFE4E4',
      '--md-sys-color-surface-container-highest': '#E9DEDE',
      '--md-sys-color-inverse-surface': '#362F2E',
      '--md-sys-color-inverse-on-surface': '#FBEEED',
      '--md-sys-color-inverse-primary': '#FFB4AB',
    },
    dark: {
      '--md-sys-color-primary': '#FFB4AB',
      '--md-sys-color-on-primary': '#690005',
      '--md-sys-color-primary-container': '#93000A',
      '--md-sys-color-on-primary-container': '#FFDAD6',
      '--md-sys-color-secondary': '#E7BDB9',
      '--md-sys-color-on-secondary': '#442926',
      '--md-sys-color-secondary-container': '#5D3F3C',
      '--md-sys-color-on-secondary-container': '#FFDAD6',
      '--md-sys-color-tertiary': '#DFC38C',
      '--md-sys-color-on-tertiary': '#3D2D05',
      '--md-sys-color-tertiary-container': '#57431A',
      '--md-sys-color-on-tertiary-container': '#FDDFA6',
      '--md-sys-color-error': '#FFB4AB',
      '--md-sys-color-on-error': '#690005',
      '--md-sys-color-error-container': '#93000A',
      '--md-sys-color-on-error-container': '#FFDAD6',
      '--md-sys-color-background': '#201A1A',
      '--md-sys-color-on-background': '#EDE0DE',
      '--md-sys-color-surface': '#201A1A',
      '--md-sys-color-on-surface': '#EDE0DE',
      '--md-sys-color-surface-variant': '#534341',
      '--md-sys-color-on-surface-variant': '#D8C2BF',
      '--md-sys-color-outline': '#A08C8A',
      '--md-sys-color-outline-variant': '#534341',
      '--md-sys-color-surface-container-lowest': '#140E0E',
      '--md-sys-color-surface-container-low': '#201A1A',
      '--md-sys-color-surface-container': '#241E1E',
      '--md-sys-color-surface-container-high': '#2F2827',
      '--md-sys-color-surface-container-highest': '#3A3232',
      '--md-sys-color-inverse-surface': '#EDE0DE',
      '--md-sys-color-inverse-on-surface': '#362F2E',
      '--md-sys-color-inverse-primary': '#B3261E',
    }
  },
  teal: {
    name: '青色清风', emoji: '🩵', seed: '#006A6A',
    light: {
      '--md-sys-color-primary': '#006A6A',
      '--md-sys-color-on-primary': '#FFFFFF',
      '--md-sys-color-primary-container': '#9CF1F1',
      '--md-sys-color-on-primary-container': '#002020',
      '--md-sys-color-secondary': '#4A6363',
      '--md-sys-color-on-secondary': '#FFFFFF',
      '--md-sys-color-secondary-container': '#CCE8E8',
      '--md-sys-color-on-secondary-container': '#051F1F',
      '--md-sys-color-tertiary': '#4B607C',
      '--md-sys-color-on-tertiary': '#FFFFFF',
      '--md-sys-color-tertiary-container': '#D3E4FF',
      '--md-sys-color-on-tertiary-container': '#041D34',
      '--md-sys-color-error': '#BA1A1A',
      '--md-sys-color-on-error': '#FFFFFF',
      '--md-sys-color-error-container': '#FFDAD6',
      '--md-sys-color-on-error-container': '#410002',
      '--md-sys-color-background': '#FAFDFC',
      '--md-sys-color-on-background': '#191C1C',
      '--md-sys-color-surface': '#FAFDFC',
      '--md-sys-color-on-surface': '#191C1C',
      '--md-sys-color-surface-variant': '#DAE5E4',
      '--md-sys-color-on-surface-variant': '#3F4948',
      '--md-sys-color-outline': '#6F7979',
      '--md-sys-color-outline-variant': '#BEC9C8',
      '--md-sys-color-surface-container-lowest': '#FFFFFF',
      '--md-sys-color-surface-container-low': '#F0F4F4',
      '--md-sys-color-surface-container': '#ECF1F0',
      '--md-sys-color-surface-container-high': '#E6EBEA',
      '--md-sys-color-surface-container-highest': '#E0E5E5',
      '--md-sys-color-inverse-surface': '#2D3131',
      '--md-sys-color-inverse-on-surface': '#EFF1F0',
      '--md-sys-color-inverse-primary': '#80D5D4',
    },
    dark: {
      '--md-sys-color-primary': '#80D5D4',
      '--md-sys-color-on-primary': '#003737',
      '--md-sys-color-primary-container': '#004F4F',
      '--md-sys-color-on-primary-container': '#9CF1F1',
      '--md-sys-color-secondary': '#B0CCCC',
      '--md-sys-color-on-secondary': '#1B3535',
      '--md-sys-color-secondary-container': '#324B4B',
      '--md-sys-color-on-secondary-container': '#CCE8E8',
      '--md-sys-color-tertiary': '#B3CAE8',
      '--md-sys-color-on-tertiary': '#1C334B',
      '--md-sys-color-tertiary-container': '#334962',
      '--md-sys-color-on-tertiary-container': '#D3E4FF',
      '--md-sys-color-error': '#FFB4AB',
      '--md-sys-color-on-error': '#690005',
      '--md-sys-color-error-container': '#93000A',
      '--md-sys-color-on-error-container': '#FFDAD6',
      '--md-sys-color-background': '#191C1C',
      '--md-sys-color-on-background': '#E0E5E5',
      '--md-sys-color-surface': '#191C1C',
      '--md-sys-color-on-surface': '#E0E5E5',
      '--md-sys-color-surface-variant': '#3F4948',
      '--md-sys-color-on-surface-variant': '#BEC9C8',
      '--md-sys-color-outline': '#899392',
      '--md-sys-color-outline-variant': '#3F4948',
      '--md-sys-color-surface-container-lowest': '#0C0F0F',
      '--md-sys-color-surface-container-low': '#191C1C',
      '--md-sys-color-surface-container': '#1D2020',
      '--md-sys-color-surface-container-high': '#272B2B',
      '--md-sys-color-surface-container-highest': '#323636',
      '--md-sys-color-inverse-surface': '#E0E5E5',
      '--md-sys-color-inverse-on-surface': '#2D3131',
      '--md-sys-color-inverse-primary': '#006A6A',
    }
  }
};

// ThemeManager
class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'zgq-blog-theme';
    this.currentSettings = this.loadSettings();
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validColors = ['blue', 'purple', 'green', 'orange', 'rose', 'teal'];
        if (!validColors.includes(parsed.color)) parsed.color = 'blue';
        if (parsed.mode !== 'light' && parsed.mode !== 'dark' && parsed.mode !== 'system') parsed.mode = 'system';
        return parsed;
      }
    } catch (_) {}
    return { color: 'blue', mode: 'system' };
  }

  saveSettings() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentSettings));
  }

  getEffectiveDark() {
    const { mode } = this.currentSettings;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return this.mediaQuery.matches;
  }

  previewTheme(color, mode) {
    const isDark = (mode === 'dark') || (mode === 'light' ? false : this.mediaQuery.matches);
    const root = document.documentElement;

    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.setAttribute('data-color', color);

    const palette = THEMES[color]?.[isDark ? 'dark' : 'light'] ?? THEMES.blue.light;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', palette['--md-sys-color-surface'] ?? '#FDFCFF');
  }

  applyTheme(color = this.currentSettings.color, mode = this.currentSettings.mode) {
    this.currentSettings = { color, mode };
    this.saveSettings();
    this.previewTheme(color, mode);
    
    const isDark = this.getEffectiveDark();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { color, mode, isDark } }));
  }

  init() {
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentSettings.mode === 'system') this.applyTheme();
    });

    this.buildDialog();
  }

  buildDialog() {
    const dialog = document.getElementById('themeDialog');
    if (!dialog) return;

    const { color, mode } = this.currentSettings;

    // Mode radio buttons
    dialog.querySelectorAll('[data-mode]').forEach(el => {
      el.checked = el.dataset.mode === mode;
      el.addEventListener('change', () => {
        this._pendingColor = this._pendingColor ?? color;
        this._pendingMode = el.dataset.mode;
        this.updateDialogPreview();
      });
    });

    // Color swatches
    dialog.querySelectorAll('[data-color]').forEach(el => {
      if (el.dataset.color === color) el.classList.add('selected');
      el.addEventListener('click', () => {
        dialog.querySelectorAll('[data-color]').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
        this._pendingColor = el.dataset.color;
        this.updateDialogPreview();
      });
    });

    // Apply button
    document.getElementById('themeApplyBtn')?.addEventListener('click', () => {
      this.applyTheme(
        this._pendingColor ?? this.currentSettings.color,
        this._pendingMode ?? this.currentSettings.mode
      );
      this._pendingColor = null;
      this._pendingMode = null;
      dialog.close();
    });

    // Cancel button
    document.getElementById('themeCancelBtn')?.addEventListener('click', () => {
      this._pendingColor = null;
      this._pendingMode = null;
      dialog.close();
    });

    // Open button
    document.getElementById('themeDialogBtn')?.addEventListener('click', () => {
      this._pendingColor = this.currentSettings.color;
      this._pendingMode = this.currentSettings.mode;
      dialog.querySelectorAll('[data-mode]').forEach(el => {
        el.checked = el.dataset.mode === this.currentSettings.mode;
      });
      dialog.querySelectorAll('[data-color]').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === this.currentSettings.color);
      });
      dialog.showModal();
    });
  }

  updateDialogPreview() {
    const c = this._pendingColor ?? this.currentSettings.color;
    const m = this._pendingMode ?? this.currentSettings.mode;
    const isDark = m === 'dark' ? true : m === 'light' ? false : this.mediaQuery.matches;
    const palette = THEMES[c]?.[isDark ? 'dark' : 'light'] ?? THEMES.blue.light;

    const preview = document.getElementById('themePreview');
    if (preview) {
      preview.style.background = palette['--md-sys-color-primary-container'];
      preview.style.color = palette['--md-sys-color-on-primary-container'];

      const swatches = preview.querySelectorAll('.preview-swatch');
      const colors = [
        palette['--md-sys-color-primary'],
        palette['--md-sys-color-secondary'],
        palette['--md-sys-color-tertiary']
      ];
      swatches.forEach((s, i) => { if (colors[i]) s.style.background = colors[i]; });
    }
  }
}

// Sidebar Toggle
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuBtn = document.getElementById('menuBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const expandBtn = document.getElementById('navRailExpandBtn');

  const open = () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  };

  menuBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);

  expandBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('expanded');
    const icon = expandBtn.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = sidebar?.classList.contains('expanded') ? 'menu_open' : 'menu';
    }
  });

  const scrollContainer = document.getElementById('sidebarScroll');
  const scrollbar = document.getElementById('sidebarScrollbar');
  const thumb = document.getElementById('sidebarScrollbarThumb');

  if (scrollContainer && scrollbar && thumb) {
    const updateScrollbar = () => {
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const scrollTop = scrollContainer.scrollTop;

      if (scrollHeight > clientHeight) {
        scrollbar.classList.add('visible');
        
        const ratio = clientHeight / scrollHeight;
        const thumbHeight = Math.max(30, clientHeight * ratio);
        thumb.style.height = `${thumbHeight}px`;

        const scrollRatio = scrollTop / (scrollHeight - clientHeight);
        const maxThumbTop = clientHeight - thumbHeight;
        const thumbTop = scrollRatio * maxThumbTop;
        
        thumb.style.transform = `translateY(${thumbTop}px)`;
      } else {
        scrollbar.classList.remove('visible');
      }
    };

    scrollContainer.addEventListener('scroll', updateScrollbar, { passive: true });
    window.addEventListener('resize', updateScrollbar, { passive: true });

    setTimeout(updateScrollbar, 150);
  }
}

// Reading Progress Bar
function initReadingProgress() {
  const bar = document.getElementById('readingProgress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${Math.min(100, progress)}%`;
  }, { passive: true });
}

// Active Nav Highlighting
function initActiveNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const isActive = href === '/'
      ? currentPath === '/'
      : currentPath.startsWith(href);
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
  });
}

// View Toggle
function initViewToggle() {
  const gallery = document.getElementById('postGallery');
  if (!gallery) return;

  const savedView = localStorage.getItem('zgq-view') || 'grid';
  gallery.className = `gallery-container ${savedView}-mode`;

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === savedView);
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      gallery.style.opacity = '0';
      gallery.style.transform = 'scale(0.97)';
      gallery.style.transition = 'opacity 150ms cubic-bezier(0.3,0,1,1), transform 150ms cubic-bezier(0.3,0,1,1)';
      setTimeout(() => {
        gallery.className = `gallery-container ${view}-mode`;
        gallery.style.opacity = '1';
        gallery.style.transform = 'scale(1)';
        gallery.style.transition = 'opacity 200ms cubic-bezier(0.05,0.7,0.1,1), transform 200ms cubic-bezier(0.05,0.7,0.1,1)';
        localStorage.setItem('zgq-view', view);
        document.querySelectorAll('[data-view]').forEach(b => {
          b.classList.toggle('active', b.dataset.view === view);
        });
      }, 160);
    });
  });
}

// Top App Bar
function initTopAppBar() {
  const bar = document.querySelector('.top-app-bar');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    bar.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });
}

// Theme Dialog
function initThemeDialog() {
  const dialog = document.getElementById('themeDialog');
  if (!dialog) return;

  function syncModeButtons(mode) {
    dialog.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  function syncSwatches(color) {
    dialog.querySelectorAll('.color-swatch[data-color]').forEach(el => {
      el.classList.toggle('selected', el.dataset.color === color);
    });
  }

  const { color, mode } = window.themeManager.currentSettings;
  syncModeButtons(mode);
  syncSwatches(color);

  dialog.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.themeManager._pendingMode = btn.dataset.mode;
      syncModeButtons(btn.dataset.mode);
      window.themeManager.previewTheme(
        window.themeManager._pendingColor ?? window.themeManager.currentSettings.color,
        window.themeManager._pendingMode
      );
    });
  });

  dialog.querySelectorAll('.color-swatch[data-color]').forEach(el => {
    el.addEventListener('click', () => {
      window.themeManager._pendingColor = el.dataset.color;
      syncSwatches(el.dataset.color);
      window.themeManager.previewTheme(
        window.themeManager._pendingColor,
        window.themeManager._pendingMode ?? window.themeManager.currentSettings.mode
      );
    });
  });

  document.getElementById('themeApplyBtn')?.addEventListener('click', () => {
    const c = window.themeManager._pendingColor ?? window.themeManager.currentSettings.color;
    const m = window.themeManager._pendingMode  ?? window.themeManager.currentSettings.mode;
    window.themeManager.applyTheme(c, m);
    window.themeManager._pendingColor = null;
    window.themeManager._pendingMode  = null;
    closeThemeDialog();
  });

  function revertTheme() {
    window.themeManager._pendingColor = null;
    window.themeManager._pendingMode  = null;
    window.themeManager.previewTheme(
      window.themeManager.currentSettings.color,
      window.themeManager.currentSettings.mode
    );
    closeThemeDialog();
  }

  document.getElementById('themeCancelBtn')?.addEventListener('click', revertTheme);
  document.getElementById('themeCancelBtnX')?.addEventListener('click', revertTheme);
  dialog.querySelector('.theme-dialog-scrim')?.addEventListener('click', revertTheme);

  document.querySelectorAll('#themeDialogBtn').forEach(btn => {
    btn?.addEventListener('click', openThemeDialog);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dialog.classList.contains('open')) revertTheme();
  });

  function openThemeDialog() {
    const { color, mode } = window.themeManager.currentSettings;
    syncModeButtons(mode);
    syncSwatches(color);
    dialog.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeThemeDialog() {
    dialog.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.openThemeDialog  = openThemeDialog;
  window.closeThemeDialog = closeThemeDialog;
}

// Page Transition
function initPageTransitions() {
  const main = document.querySelector('.main-content');
  const isNavigating = sessionStorage.getItem('isNavigating');
  sessionStorage.removeItem('isNavigating');

  if (main) {
    if (isNavigating) {
      main.style.transition = 'none';
      main.style.opacity = '0';
      main.style.transform = 'translateY(16px)';
      main.style.filter = 'blur(2px)';
      
      document.documentElement.classList.remove('is-navigating');
      
      requestAnimationFrame(() => {
        // Unlock transitions before triggering the enter animation
        document.body.classList.remove('preload');
        
        // Force layout flush for Firefox to prevent frame coalescing
        void document.body.offsetHeight;
        
        requestAnimationFrame(() => {
          main.style.transition = 'opacity 400ms cubic-bezier(0.05,0.7,0.1,1), transform 400ms cubic-bezier(0.05,0.7,0.1,1), filter 400ms';
          main.style.opacity = '1';
          main.style.transform = 'translateY(0)';
          main.style.filter = 'blur(0)';
        });
      });
    } else {
      document.documentElement.classList.remove('is-navigating');
      requestAnimationFrame(() => {
        document.body.classList.remove('preload');
      });
    }

    window.addEventListener('pageshow', e => {
      if (e.persisted) {
        document.documentElement.classList.remove('is-navigating');
        main.style.transition = 'none';
        main.style.opacity = '1';
        main.style.transform = 'none';
        main.style.filter = 'none';
      }
    });
  } else {
    document.documentElement.classList.remove('is-navigating');
  }

  // Exit animation on navigation
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto')
      || link.hasAttribute('target') || e.ctrlKey || e.metaKey || e.shiftKey) return;

    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
    } catch { return; }

    e.preventDefault();

    if (main) {
      main.style.transition = 'opacity 120ms cubic-bezier(0.3,0,1,1), transform 120ms cubic-bezier(0.3,0,1,1), filter 120ms';
      main.style.opacity = '0';
      main.style.transform = 'translateY(8px) scale(0.99)';
      main.style.filter = 'blur(1px)';
    }

    sessionStorage.setItem('isNavigating', 'true');
    setTimeout(() => { window.location.href = href; }, 125);
  });
}

// Ripple Pointer Position Tracking
function initRipples() {
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.nav-item, .post-card, .social-btn, .color-swatch, .page-btn, #themeDialogBtn, #backToTopBtn, .btn, .action-btn, .mode-btn');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
    el.style.setProperty('--ripple-y', `${((e.clientY - rect.top)  / rect.height * 100).toFixed(1)}%`);
  }, { passive: true });

  // Fluent Design Background Reveal for buttons and cards
  document.addEventListener('pointermove', e => {
    const el = e.target.closest('.nav-item, .social-btn, .color-swatch, .page-btn, #themeDialogBtn, #backToTopBtn, .btn, .action-btn, .mode-btn, .android-search-bar, .post-card, .link-card, .timeline-card');
    if (!el) return;
    
    let glow = el.querySelector('.fluent-bg-glow');
    if (!glow) {
      glow = document.createElement('span');
      glow.className = 'fluent-bg-glow';
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      if (getComputedStyle(el).overflow !== 'hidden') {
        el.style.overflow = 'hidden';
      }
      el.appendChild(glow);
    }
    
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--hover-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--hover-y', `${e.clientY - rect.top}px`);
  }, { passive: true });
}

// Init
window.themeManager = new ThemeManager();
window.themeManager.applyTheme();

// Back to Top FAB
function initBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  window.themeManager.init();
  initSidebar();
  initReadingProgress();
  initActiveNav();
  initViewToggle();
  initTopAppBar();
  initThemeDialog();
  initPageTransitions();
  initRipples();
  initBackToTop();
  initTagCloudCollapse();
  initSmoothAnchorJumps();
});

// Toast Notification System
window.showToast = function(msg) {
  let toast = document.getElementById('md-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'md-toast';
    toast.className = 'md-toast';
    document.body.appendChild(toast);
  }
  
  toast.classList.remove('show');
  void toast.offsetWidth;
  
  toast.textContent = msg;
  toast.classList.add('show');
  
  if (toast.hideTimeout) {
    clearTimeout(toast.hideTimeout);
  }
  
  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
};

// Fluent Design Hover Reveal Effect
window.addEventListener('DOMContentLoaded', () => {
  const fluentGrids = document.querySelectorAll('.gallery-container, .links-grid, .timeline');
  fluentGrids.forEach(grid => {
    grid.addEventListener('mousemove', e => {
      const cards = grid.querySelectorAll('.post-card, .link-card, .timeline-card');
      cards.forEach(card => {
        let glow = card.querySelector('.fluent-glow');
        if (!glow) {
          glow = document.createElement('span');
          glow.className = 'fluent-glow';
          card.appendChild(glow);
        }
        
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".scroll-animate");
  if (!cards.length) return;

  // Stagger index for initial load
  let initialStaggerCount = 0;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;
        
        // Add a slight stagger for the initial batch of visible cards
        // For cards scrolled into view later, animate immediately
        const delay = initialStaggerCount < 15 ? (initialStaggerCount * 50) : 0;
        if (initialStaggerCount < 15) {
          initialStaggerCount++;
        }
        
        if (delay > 0) {
          card.style.animationDelay = delay + "ms";
        }
        card.classList.add("animate-fade-in-up");
        card.style.opacity = ""; // Remove the inline opacity: 0 so animation can take over
        obs.unobserve(card);
      }
    });
  }, {
    rootMargin: "50px 0px", // Trigger slightly before it comes into view
    threshold: 0.05
  });

  cards.forEach(card => observer.observe(card));
});

// MD3 Collapsible Tag Cloud Component Controller
function initTagCloudCollapse() {
  const card = document.getElementById('tagCloudCard');
  const viewport = document.getElementById('tagCloudViewport');
  const topBtn = document.getElementById('tagCollapseToggleBtn');
  if (!card || !viewport || !topBtn) return;

  let isExpanded = false;

  function toggleExpand(expand) {
    if (typeof expand === 'boolean') {
      isExpanded = expand;
    } else {
      isExpanded = !isExpanded;
    }

    if (isExpanded) {
      const content = viewport.querySelector('.tag-cloud');
      const targetHeight = content ? (content.scrollHeight + 24) : (viewport.scrollHeight + 24);
      viewport.style.maxHeight = targetHeight + 'px';
      viewport.classList.remove('collapsed');
      viewport.classList.add('expanded');
      card.classList.add('is-expanded');

      topBtn.querySelector('.toggle-text').textContent = '收起标签';
      topBtn.setAttribute('aria-expanded', 'true');
    } else {
      viewport.style.maxHeight = '124px';
      viewport.classList.remove('expanded');
      viewport.classList.add('collapsed');
      card.classList.remove('is-expanded');

      topBtn.querySelector('.toggle-text').textContent = '展开全部';
      topBtn.setAttribute('aria-expanded', 'false');
    }
  }

  topBtn.addEventListener('click', () => toggleExpand());
}

// Universal Accurate Anchor Jump Handler
function initSmoothAnchorJumps() {
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;
    
    const href = anchor.getAttribute('href');
    if (!href || href === '#' || href.length <= 1) return;
    
    if (window.blogPagination && window.blogPagination.isInitialized) {
      e.preventDefault();
      window.blogPagination.jumpToAnchor(href);
      try { history.pushState(null, '', href); } catch (err) {}
      return;
    }

    const rawId = href.substring(1);
    let targetEl = null;
    try {
      targetEl = document.getElementById(rawId) || document.getElementById(decodeURIComponent(rawId));
    } catch (err) {
      targetEl = document.getElementById(rawId);
    }
    
    if (targetEl) {
      e.preventDefault();
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      try { history.pushState(null, '', href); } catch (err) {}

      // MD3 Pulse highlight on target header
      targetEl.animate([
        { background: 'color-mix(in srgb, var(--md-sys-color-primary-container) 85%, transparent)', borderRadius: '12px', paddingLeft: '12px' },
        { background: 'transparent', borderRadius: '', paddingLeft: '' }
      ], { duration: 2000, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    }
  });

  if (window.location.hash && window.location.hash.length > 1) {
    setTimeout(() => {
      if (window.blogPagination && window.blogPagination.isInitialized) {
        window.blogPagination.jumpToAnchor(window.location.hash);
        return;
      }
      const rawId = window.location.hash.substring(1);
      let targetEl = null;
      try {
        targetEl = document.getElementById(rawId) || document.getElementById(decodeURIComponent(rawId));
      } catch (err) {
        targetEl = document.getElementById(rawId);
      }
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetEl.animate([
          { background: 'color-mix(in srgb, var(--md-sys-color-primary-container) 85%, transparent)', borderRadius: '12px', paddingLeft: '12px' },
          { background: 'transparent', borderRadius: '', paddingLeft: '' }
        ], { duration: 2000, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      }
    }, 150);
  }
}


