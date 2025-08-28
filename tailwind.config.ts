import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./src/**/*.{ts,tsx}",
		"./index.html",
	],
	safelist: [
		// Critical button variants and sizes used on initial page
		"bg-gradient-to-r", "from-[hsl(var(--brand-500))]", "to-[hsl(var(--brand-600))]",
		"text-[hsl(var(--hero-foreground))]", "shadow-[var(--shadow-soft)]",
		"hover:brightness-110", "focus-visible:ring-[hsl(var(--brand-500))]",
		
		// Essential responsive utilities
		"md:hidden", "hidden", "md:flex", "lg:text-8xl", "md:text-8xl",
		"md:text-5xl", "text-4xl", "text-6xl",
		
		// Critical layout and spacing
		"h-screen", "min-h-screen", "flex", "flex-col", "items-center", "justify-center",
		"justify-between", "space-y-6", "space-y-8", "gap-3", "gap-4",
		
		// Animation classes
		"animate-spin", "rounded-full", "border-b-2", "border-brand-500",
		
		// Brand colors and gradients used in components
		"bg-clip-text", "text-transparent", "bg-gradient-to-br",
		"from-background", "to-muted", "from-[hsl(var(--brand-400))]",
		"to-[hsl(var(--brand-600))]",
		
		// Essential typography
		"font-extrabold", "tracking-tight", "text-muted-foreground",
		"text-foreground", "text-sm", "text-xs",
		
		// Critical interactive states
		"hover:text-foreground", "hover:underline", "underline-offset-4",
		"transition-colors", "cursor-not-allowed",
		
		// Position utilities for footer
		"absolute", "bottom-2", "md:bottom-6", "text-center",
		
		// Padding and margins used frequently
		"px-4", "px-6", "px-8", "py-4", "pt-10", "pb-4", "py-[24px]"
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			gridTemplateColumns: {
				'4': 'repeat(4, minmax(0, 1fr))',
				'5': 'repeat(5, minmax(0, 1fr))',
				'6': 'repeat(6, minmax(0, 1fr))',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				brand: {
					400: 'hsl(var(--brand-400))',
					500: 'hsl(var(--brand-500))',
					600: 'hsl(var(--brand-600))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
