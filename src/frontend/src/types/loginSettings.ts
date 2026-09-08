export type LoginSettings = {
  systemName: string
  title: string
  subtitle: string
  welcomeMessage: string
  showLogo: boolean
  showSubtitle: boolean
  showWelcomeMessage: boolean
  logoMainUrl: string | null
  logoLoginUrl: string | null
  backgroundType: 'color' | 'image' | 'video'
  backgroundImageUrl: string | null
  backgroundVideoUrl: string | null
  backgroundVideoMuted: boolean
  backgroundVideoStartSeconds: number | null
  backgroundVideoEndSeconds: number | null
  backgroundColor: string
  backgroundPosition: string
  backgroundSize: string
  backgroundRepeat: string
  overlayColor: string
  overlayOpacity: number
  colorPrimary: string
  colorSecondary: string
  colorText: string
  colorTextSecondary: string
  colorFormBg: string
  colorFormBgOpacity: number
  colorButton: string
  colorButtonHover: string
  colorError: string
  colorBorder: string
  colorInputBg: string
  buttonText: string
  placeholderUsername: string
  placeholderPassword: string
  updatedAt?: string
}
