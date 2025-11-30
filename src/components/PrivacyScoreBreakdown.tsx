import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';
import { Spacing } from '../design/spacing';

interface PrivacyScoreBreakdownProps {
  privacyScore?: number; // Overall privacy score 0-100
}

// Thick semi-circular progress bar
const SemiCircleProgress: React.FC<{
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}> = ({ percentage, color, size = 140, strokeWidth = 18 }) => {
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size; // Position center at bottom for semi-circle
  
  // Normalize percentage
  const normalizedPercentage = Math.min(Math.max(percentage, 0), 100);
  
  // Calculate angle in radians
  // Semi-circle goes from 0° (right) to 180° (left), opening at bottom
  // Fill from right to left counter-clockwise
  const startAngle = 0; // Start at right (0°)
  const endAngle = (normalizedPercentage / 100) * Math.PI; // End angle: 0 to π (0° to 180°)
  
  // Calculate start point (right side at 0°)
  const startX = centerX + radius;
  const startY = centerY;
  
  // Calculate end point
  // For a semi-circle opening downward, angles are measured from right (0°) going counter-clockwise
  // endAngle goes from 0 to π, so we use it directly
  const endX = centerX + radius * Math.cos(endAngle);
  const endY = centerY - radius * Math.sin(endAngle);
  
  // Large arc flag: 1 if we're going more than 180 degrees (shouldn't happen for semi-circle, but keep for safety)
  const largeArcFlag = normalizedPercentage > 50 ? 1 : 0;
  
  // Create the arc path (sweep flag = 1 for counter-clockwise)
  const pathData = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  
  // Background arc (full semi-circle) - goes counter-clockwise from right (0°) to left (π)
  const backgroundPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${centerX - radius} ${centerY}`;
  
  // ViewBox: show only the top half (semi-circle)
  // The semi-circle is centered at bottom, so we show from centerY - radius to centerY
  const viewBoxY = centerY - radius - strokeWidth / 2;
  const viewBoxHeight = radius + strokeWidth;
  
  return (
    <Svg 
      width={size} 
      height={size / 2 + strokeWidth / 2} 
      viewBox={`0 ${viewBoxY} ${size} ${viewBoxHeight}`}
      style={{ overflow: 'visible' }}
    >
      {/* Background arc (unfilled portion) */}
      <Path
        d={backgroundPath}
        stroke={Colors.cardBorderSecondary || '#1a1a1a'}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
      {/* Progress arc (filled portion) */}
      {normalizedPercentage > 0 && (
        <Path
          d={pathData}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
};

export default function PrivacyScoreBreakdown({
  privacyScore = 0,
}: PrivacyScoreBreakdownProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const viewRef = useRef<View>(null);

  // Calculate privacy score color based on value
  const getPrivacyColor = (score: number) => {
    if (score >= 80) return Colors.success; // Green for high privacy
    if (score >= 50) return Colors.warning; // Orange for medium privacy
    return Colors.error; // Red for low privacy
  };

  const getPrivacyDescription = (score: number) => {
    if (score >= 80) return 'Your wallet has strong privacy protection';
    if (score >= 50) return 'Within the recommended norm';
    if (score >= 30) return 'Consider improving your wallet privacy';
    return 'Your wallet privacy needs attention';
  };

  const startAnimation = () => {
    if (hasAnimated || !isVisible) return;
    
    setHasAnimated(true);
    let current = 0;
    const target = privacyScore;
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = target / steps;
    const intervalTime = duration / steps;

    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      setAnimatedScore(current);
    }, intervalTime);
  };

  // Handle layout to detect when component is visible (scrolled into view)
  const handleLayout = (event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    // Component is considered visible if it has a layout
    if (y >= 0 && !isVisible) {
      setIsVisible(true);
    }
  };

  // Start animation when component becomes visible
  useEffect(() => {
    if (isVisible && !hasAnimated) {
      // Small delay to ensure smooth scroll-to animation
      const timer = setTimeout(() => {
        startAnimation();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, privacyScore]);

  // Reset animation when score changes significantly
  useEffect(() => {
    if (Math.abs(privacyScore - animatedScore) > 10 && hasAnimated) {
      setAnimatedScore(0);
      setHasAnimated(false);
      if (isVisible) {
        setTimeout(() => startAnimation(), 100);
      }
    }
  }, [privacyScore]);

  const privacyColor = getPrivacyColor(privacyScore);
  const displayScore = Math.round(animatedScore);
  const descriptionText = getPrivacyDescription(privacyScore);

  return (
    <View 
      ref={viewRef} 
      style={styles.container}
      onLayout={handleLayout}
    >
      <View style={styles.content}>
        {/* Title with colored dot */}
        <View style={styles.titleRow}>
          <View style={[styles.statusDot, { backgroundColor: privacyColor }]} />
          <Text style={styles.title}>Wallet Privacy Score</Text>
        </View>
        
        {/* Description */}
        <Text style={styles.description}>{descriptionText}</Text>
        
        {/* Percentage and Chart side by side */}
        <View style={styles.scoreRow}>
          {/* Large percentage */}
          <View style={styles.percentageContainer}>
            <Text style={[styles.percentageValue, { color: privacyColor }]}>
              {displayScore}%
            </Text>
          </View>
          
          {/* Semi-circular progress bar */}
          <View style={styles.graphContainer}>
            <SemiCircleProgress
              percentage={displayScore}
              color={privacyColor}
              size={140}
              strokeWidth={18}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  content: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    width: '100%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
  },
  description: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  percentageContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: Spacing['5xl'],
  },
  percentageValue: {
    fontSize: 48,
    fontWeight: Typography.fontWeight.bold,
  },
  graphContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing['3xl'],
  },
})
