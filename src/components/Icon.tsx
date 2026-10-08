import { StyleProp, ViewStyle } from 'react-native';
import {
    Accessibility,
    Activity,
    Apple,
    ArrowRight,
    Award,
    Ban,
    BedDouble,
    Bell,
    BookOpen,
    Brain,
    CalendarDays,
    ChartColumn,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleCheck,
    CirclePlus,
    Clock,
    Code,
    Coffee,
    Droplet,
    Dumbbell,
    EyeOff,
    Flame,
    Footprints,
    Globe,
    Hourglass,
    Info,
    KeyRound,
    Layers,
    LayoutDashboard,
    LayoutGrid,
    Leaf,
    ListChecks,
    LucideIcon,
    Minus,
    Moon,
    Music,
    Palette,
    Pause,
    PenLine,
    Pencil,
    PhoneOff,
    Play,
    Plus,
    RotateCcw,
    Search,
    Server,
    Settings,
    ShieldAlert,
    ShieldCheck,
    SkipForward,
    SlidersHorizontal,
    Sparkles,
    Square,
    Sun,
    Target,
    Timer,
    Trash2,
    TrendingUp,
    TriangleAlert,
    Trophy,
    Vibrate,
    Volume2,
    Waves,
    Wind,
    X,
    Zap,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const ICONS = {
    // Tabs (keyed by route name)
    Home: LayoutDashboard,
    Habits: ListChecks,
    Breathe: Waves,
    Block: CirclePlus,
    Settings: Settings,
    // General
    Search: Search,
    Close: X,
    Plus: Plus,
    Minus: Minus,
    Next: ChevronRight,
    Back: ChevronLeft,
    ArrowRight: ArrowRight,
    Arrow: ChevronDown,
    Selected: CircleCheck,
    Check: Check,
    Calendar: CalendarDays,
    Time: Clock,
    Trash: Trash2,
    Hide: EyeOff,
    Edit: Pencil,
    Info: Info,
    Alert: TriangleAlert,
    Bell: Bell,
    Trophy: Trophy,
    Award: Award,
    Flame: Flame,
    Chart: ChartColumn,
    Trend: TrendingUp,
    Sliders: SlidersHorizontal,
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
    Apps: LayoutGrid,
    // Training
    Timer: Timer,
    Hourglass: Hourglass,
    Wind: Wind,
    Waves: Waves,
    Play: Play,
    Pause: Pause,
    Stop: Square,
    Skip: SkipForward,
    Restart: RotateCcw,
    Target: Target,
    Zap: Zap,
    Sound: Volume2,
    Vibrate: Vibrate,
    // Habit icons
    Dumbbell: Dumbbell,
    Book: BookOpen,
    Brain: Brain,
    Droplet: Droplet,
    Footprints: Footprints,
    Sun: Sun,
    Pen: PenLine,
    Music: Music,
    Code: Code,
    Apple: Apple,
    Bed: BedDouble,
    PhoneOff: PhoneOff,
    Leaf: Leaf,
    Coffee: Coffee,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const isIconName = (value: unknown): value is IconName => typeof value === 'string' && value in ICONS;

type IconOpacity = 'normal' | 'muted' | 'faded';

interface IconProps {
    name: IconName;
    size?: number;
    opacity?: IconOpacity;
    /** false = success green (used for "done" checks); a string = that color; default = text color. */
    tint?: string | false;
    strokeWidth?: number;
    style?: StyleProp<ViewStyle>;
}

const OPACITY: Record<IconOpacity, number> = {
    normal: 1,
    muted: 0.8,
    faded: 0.6,
};

const Icon: React.FC<IconProps> = ({ name, size = 24, opacity = 'normal', tint, strokeWidth = 1.8, style }) => {
    const { theme } = useTheme();
    const Glyph = ICONS[name] ?? CircleCheck;
    const color = tint === false ? theme.colors.primaryGreen : tint ?? theme.colors.text;

    return (
        <Glyph
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            style={[{ opacity: OPACITY[opacity] }, style] as any}
        />
    );
};

export default Icon;
