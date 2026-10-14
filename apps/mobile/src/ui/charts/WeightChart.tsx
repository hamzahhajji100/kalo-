import { daysBetween, type TrendPoint } from '@kalo/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { linear, niceScale } from '@/features/progress/chartMath';
import { isoToDate } from '@/lib/date';
import { formatDate, formatDecimal } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { ChartFrame, LegendItem, Tooltip } from './ChartFrame';

const H = 200;
const PAD = { top: 44, right: 8, bottom: 22, left: 34 };

/** Daily weigh-ins as dots, smoothed trend as a line, optional target as a dashed reference. */
export function WeightChart({
  points: kgPoints,
  targetKg,
  toDisplay = (kg: number) => kg,
  unit = 'kg',
}: {
  points: TrendPoint[];
  targetKg: number | null;
  /** Converts stored kg to the display unit (lb for imperial). */
  toDisplay?: (kg: number) => number;
  unit?: string;
}) {
  const { t } = useTranslation();
  const { color } = useTheme();
  const [active, setActive] = useState<number | null>(null);
  if (kgPoints.length === 0) return null;
  const points = kgPoints.map((p) => ({
    ...p,
    kg: toDisplay(p.kg),
    trendKg: toDisplay(p.trendKg),
  }));
  const target = targetKg === null ? null : toDisplay(targetKg);

  const first = points[0]!.date;
  const last = points.at(-1)!.date;
  const span = Math.max(1, daysBetween(first, last));
  const values = points
    .flatMap((p) => [p.kg, p.trendKg])
    .concat(
      target !== null && Math.abs(target - points.at(-1)!.trendKg) < toDisplay(8) ? [target] : [],
    );
  const scale = niceScale(Math.min(...values), Math.max(...values), 4);
  const fmtDay = (iso: string) => formatDate(isoToDate(iso), { day: '2-digit', month: '2-digit' });

  return (
    <ChartFrame
      height={H}
      summary={t('charts.weightSummary', {
        from: fmtDay(first),
        to: fmtDay(last),
        start: formatDecimal(points[0]!.trendKg),
        end: formatDecimal(points.at(-1)!.trendKg),
      })}
      table={points
        .slice(-30)
        .reverse()
        .map((p) => ({
          label: fmtDay(p.date),
          value: `${formatDecimal(p.kg)} ${unit} (${t('charts.trend')} ${formatDecimal(p.trendKg)})`,
        }))}
      legend={
        <View className="flex-row gap-4">
          <LegendItem color={color('muted')} label={t('charts.weighIn')} />
          <LegendItem color={color('brand')} label={t('charts.trend')} kind="line" />
          {targetKg !== null && (
            <LegendItem color={color('text')} label={t('charts.target')} kind="dash" />
          )}
        </View>
      }
    >
      {(width) => {
        const x = linear([0, span], [PAD.left, width - PAD.right]);
        const y = linear([scale.min, scale.max], [H - PAD.bottom, PAD.top]);
        const px = (p: { date: string }) => x(daysBetween(first, p.date));
        const trend = points
          .map((p, i) => `${i ? 'L' : 'M'}${px(p).toFixed(1)},${y(p.trendKg).toFixed(1)}`)
          .join(' ');
        const showTarget = target !== null && target >= scale.min && target <= scale.max;
        const pick = (lx: number) => {
          let best = 0;
          points.forEach((p, i) => {
            if (Math.abs(px(p) - lx) < Math.abs(px(points[best]!) - lx)) best = i;
          });
          setActive(best);
        };
        const a = active !== null ? points[active] : undefined;
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
                  {formatDecimal(v)}
                </SvgText>
              ))}
              <SvgText x={PAD.left} y={H - 6} fontSize={11} fill={color('muted')}>
                {fmtDay(first)}
              </SvgText>
              <SvgText
                x={width - PAD.right}
                y={H - 6}
                fontSize={11}
                fill={color('muted')}
                textAnchor="end"
              >
                {fmtDay(last)}
              </SvgText>
              {showTarget && (
                <>
                  <Line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(targetKg!)}
                    y2={y(targetKg!)}
                    stroke={color('text')}
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <SvgText
                    x={width - PAD.right}
                    y={y(target!) - 5}
                    fontSize={11}
                    fill={color('muted')}
                    textAnchor="end"
                  >
                    {t('charts.targetValue', { value: `${formatDecimal(target!)} ${unit}` })}
                  </SvgText>
                </>
              )}
              {points.length <= 120 &&
                points.map((p) => (
                  <Circle
                    key={p.date}
                    cx={px(p)}
                    cy={y(p.kg)}
                    r={3.5}
                    fill={color('muted')}
                    fillOpacity={0.55}
                  />
                ))}
              <Path
                d={trend}
                stroke={color('brand')}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {a && (
                <>
                  <Line
                    x1={px(a)}
                    x2={px(a)}
                    y1={PAD.top - 4}
                    y2={H - PAD.bottom}
                    stroke={color('muted')}
                    strokeWidth={1}
                  />
                  <Circle
                    cx={px(a)}
                    cy={y(a.trendKg)}
                    r={5}
                    fill={color('brand')}
                    stroke={color('surface')}
                    strokeWidth={2}
                  />
                </>
              )}
            </Svg>
            {a && (
              <Tooltip
                x={px(a)}
                width={width}
                lines={[
                  fmtDay(a.date),
                  `${formatDecimal(a.kg)} kg`,
                  `${t('charts.trend')} ${formatDecimal(a.trendKg)} kg`,
                ]}
              />
            )}
          </View>
        );
      }}
    </ChartFrame>
  );
}
