import type { ThemeConfig } from 'antd'

// Ant Design chỉ dùng trong /admin. Giá trị phải khớp src/styles/tokens.css (antd cần giá trị thật để sinh màu phụ).
// Đổi màu/bo góc ở tokens.css thì đổi luôn ở đây.
const NAV_BG = '#0b2e6e' // --color-nav-bg

export const adminTheme: ThemeConfig = {
  cssVar: {},
  token: {
    colorPrimary: '#0041d9', // --color-primary
    colorInfo: '#0041d9',
    colorSuccess: '#0f7b4b', // --color-success
    colorError: '#c4262e', // --color-danger
    colorText: '#121722', // --color-text
    colorTextSecondary: '#4b5468', // --color-text-subtle
    colorBorder: '#dde2eb', // --color-border
    colorBgLayout: '#f4f6fa', // --color-bg
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    borderRadius: 8, // --radius-control
    borderRadiusLG: 12, // --radius-card
    controlHeight: 36,
  },
  components: {
    Layout: {
      headerBg: NAV_BG,
      headerHeight: 56, // --admin-header-h
      headerPadding: '0 16px',
      siderBg: NAV_BG,
      triggerBg: NAV_BG,
    },
    Menu: {
      darkItemBg: NAV_BG,
      darkSubMenuItemBg: '#092559',
      darkItemColor: '#c7d4f0', // --color-nav-text
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)', // --color-nav-hover
      darkItemSelectedBg: 'rgba(255, 255, 255, 0.16)', // --color-nav-active
      darkItemSelectedColor: '#ffffff',
      darkGroupTitleColor: 'rgba(199, 212, 240, 0.6)',
      itemBorderRadius: 8,
    },
    Card: {
      headerFontSize: 16,
    },
    Table: {
      headerBg: '#f4f6fa',
      headerColor: '#4b5468',
      rowHoverBg: '#eef3ff', // --blue-50
    },
  },
}
