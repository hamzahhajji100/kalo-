import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { linear, nearestIndex, niceScale } from '@/features/progress/chartMath';
import { isoToDate } from '@/lib/date';
import { formatDate, formatInt } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ChartFrame, LegendItem, Tooltip } from './ChartFrame';

const H = 180;
const PAD = { top: 44, right: 8, bottom: 22, left: 40 };

/** Bar with a 4 px rounded top anchored to the baseline. */
function bar(x: number, w: number, yTop: number, yBase: number): string {
  const r = Math.min(4, w / 2, (yBase - yTop) / 2);
  if (yBase - yTop < 0.5) return '';
  return `M${x},${yBase} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + w - r},${yTop} Q${x + w},${yTop} ${x + w},${yTop + r} L${x + w},${yBase} Z`;
}

/** Daily calories as bars against the calorie target (a reference line, not a second series). */
export function CalorieBars({
  days,
  target,
}: {
  days: { date: string; kcal: number }[];
  target: number | null;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal));
  const scale = niceScale(0, max || 1, 3);
  const short = days.length <= 7;
  const fmt = (iso: string) =>
    formatDate(isoToDate(iso), short ? { weekday: 'short' } : { day: '2-digit', month: '2-digit' });

  return (
    <ChartFrame
      height={H}
      summary={t('charts.kcalSummary', {
        days: days.length,
        avg: formatInt(
          days.filter((d) => d.kcal > 0).reduce((s, d, _, a) => s + d.kcal / a.length, 0),
        ),
      })}
      table={[...days].reverse().map((d) => ({
        label: formatDate(isoToDate(d.date), {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        }),
        value: `${formatInt(d.kcal)} kcal`,
      }))}
      legend={
        <View className="flex-row gap-4">
          <LegendItem color={color('brand')} label={t('charts.eaten')} />
          {target !== null && (
            <LegendItem color={color('text')} label={t('charts.kcalTarget')} kind="dash" />
          )}
        </View>
      }
    >
      {(width) => {
        const inner = width - PAD.left - PAD.right;
        const slot = inner / Math.max(1, days.length);
        const gap = Math.max(2, slot * 0.25);
        const y = linear([0, scale.max], [H - PAD.bottom, PAD.top]);
        const pick = (lx: number) =>
          setActive(nearestIndex(lx - PAD.left - slot / 2, days.length, inner - slot));
        const a = active !== null ? days[active] : undefined;
        const labelEvery = Math.ceil(days.length / 6);
        return (
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
            onResponderMove={(e) => pick(e.nativeEvent.locationX)}
            onResponderRelease={() => setActive(null)}
          >
            <Svg width={width} height={H}>
              {scale.ticks.map((v) => (
                <Line
                  key={v}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={color('border')}
                  strokeWidth={1}
                />
              ))}
              {scale.ticks.map((v) => (
                <SvgText
                  key={`l${v}`}
                  x={PAD.left - 6}
                  y={y(v) + 4}
                  fontSize={11}
                  fill={color('muted')}
                  textAnchor="end"
                >
                  {formatInt(v)}
                </SvgText>
              ))}
              {days.map((d, i) => (
                <Path
                  key={d.date}
                  d={bar(PAD.left + i * slot + gap / 2, slot - gap, y(d.kcal), y(0))}
                  fill={color('brand')}
                  fillOpacity={active === null || active === i ? 1 : 0.45}
                />
              ))}
              {days.map((d, i) =>
                i % labelEvery === 0 || i === days.length - 1 ? (
                  <SvgText
                    key={`x${d.date}`}
                    x={PAD.left + i * slot + slot / 2}
                    y={H - 6}
                    fontSize={11}
                    fill={color('muted')}
                    textAnchor="middle"
                  >
                    {fmt(d.date)}
                  </SvgText>
                ) : null,
              )}
              {target !== null && (
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(target)}
                  y2={y(target)}
                  stroke={color('text')}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )}
            </Svg>
            {a && (
              <Tooltip
                x={PAD.left + active! * slot + slot / 2}
                width={width}
                lines={[
                  formatDate(isoToDate(a.date), {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  }),
                  `${formatInt(a.kcal)} kcal`,
                  ...(target
                    ? [t('charts.ofTarget', { pct: Math.round((a.kcal / target) * 100) })]
                    : []),
                ]}
              />
            )}
          </View>
        );
      }}
    </ChartFrame>
  );
}
