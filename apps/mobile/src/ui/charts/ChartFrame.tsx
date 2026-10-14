import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '../Text';

/** Measures width for the chart and offers an accessible table view of the same data. */
export function ChartFrame({
  height,
  summary,
  table,
  legend,
  children,
}: {
  height: number;
  /** Spoken summary of the chart for screen readers. */
  summary: string;
  table: { label: string; value: string }[];
  legend?: ReactNode;
  children: (width: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [showTable, setShowTable] = useState(false);
  return (
    <View className="gap-2">
      {legend}
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        {width > 0 ? children(width) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowTable((v) => !v)}
        hitSlop={8}
        className="self-end"
      >
        <Text variant="caption" className="font-semibold text-brand">
          {showTable ? t('charts.hideTable') : t('charts.showTable')}
        </Text>
      </Pressable>
      {showTable && (
        <View>
          {table.map((r) => (
            <View key={r.label} className="flex-row justify-between border-b border-border py-1.5">
              <Text variant="caption">{r.label}</Text>
              <Text className="text-text" style={{ fontVariant: ['tabular-nums'] }}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Legend entry: a small mark beside text in text colour (identity is never colour alone). */
export function LegendItem({
  color,
  label,
  kind = 'dot',
}: {
  color: string;
  label: string;
  kind?: 'dot' | 'line' | 'dash';
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      {kind === 'dot' ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      ) : (
        <View
          style={{
            width: 14,
            height: 2,
            backgroundColor: color,
            opacity: kind === 'dash' ? 0.7 : 1,
          }}
        />
      )}
      <Text variant="caption">{label}</Text>
    </View>
  );
}

/** Small floating value box for the touched point. */
export function Tooltip({ x, width, lines }: { x: number; width: number; lines: string[] }) {
  const boxW = 140;
  const left = Math.max(0, Math.min(width - boxW, x - boxW / 2));
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left, width: boxW }}
      className="rounded-xl bg-surface-2 px-2.5 py-1.5"
      accessibilityLiveRegion="polite"
    >
      {lines.map((l, i) => (
        <Text
          key={i}
          className={i === 0 ? 'text-xs text-muted' : 'text-sm font-semibold text-text'}
        >
          {l}
        </Text>
      ))}
    </View>
  );
}
