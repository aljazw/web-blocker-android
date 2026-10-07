import { StyleProp, ViewStyle } from 'react-native';
import {
    Accessibility,
    Activity,
    ArrowRight,
    Ban,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    CirclePlus,
    Clock,
    EyeOff,
    Globe,
    KeyRound,
    Layers,
    LayoutDashboard,
    LucideIcon,
    Moon,
    Palette,
    Plus,
    Search,
    Server,
    Settings,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const iconMap: Record<string, LucideIcon> = {
    // Tabs (keyed by route name)
    Home: LayoutDashboard,
    Block: CirclePlus,
    Settings: Settings,
    // General
    Search: Search,
    Close: X,
    Plus: Plus,
    Next: ChevronRight,
    Back: ChevronLeft,
    ArrowRight: ArrowRight,
    Arrow: ChevronDown,
    Selected: CircleCheck,
    Calendar: CalendarDays,
    Time: Clock,
    Trash: Trash2,
    Hide: EyeOff,
    // Protection & settings
    Shield: ShieldCheck,
    ShieldOff: ShieldAlert,
    Ban: Ban,
    Activity: Activity,
    Moon: Moon,
    Palette: Palette,
    Key: KeyRound,
    Layers: Layers,
    Globe: Globe,
    Server: Server,
    Accessibility: Accessibility,
    Sparkles: Sparkles,
};

type IconOpacity = 'normal' | 'muted' | 'faded';

interface IconProps {
    name: string;
    size?: number;
    opacity?: IconOpacity;
    /** false = success green (used for "done" checks); a string = that color; default = text color. */
    tint?: string | false;
    strokeWidth?: number;
    style?: StyleProp<ViewStyle>;
}

const opacityMap: Record<IconOpacity, number> = {
    normal: 1,
    muted: 0.8,
    faded: 0.6,
};

const Icon: React.FC<IconProps> = ({ name, size = 24, opacity = 'normal', tint, strokeWidth = 2, style }) => {
    const { theme } = useTheme();
    const Glyph = iconMap[name] ?? CircleCheck;
    const color = tint === false ? theme.colors.primaryGreen : tint ?? theme.colors.text;

    return (
        <Glyph
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            style={[{ opacity: opacityMap[opacity] }, style] as any}
        />
    );
};

export default Icon;
