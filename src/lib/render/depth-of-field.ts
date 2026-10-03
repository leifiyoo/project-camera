// One BokehPass supplies the actual rounded device/screen depth. Its optical
// gather uses a dense, softly weighted disk instead of the stock sparse rings.
// Blur radii are fractions of output height, so preview and export agree.
export const depthOfFieldShader = /* glsl */ `
  #include <common>
  #include <packing>
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform float focus;
  uniform float aperture;
  uniform float maxblur;
  uniform float focusWidth;
  uniform float nearClip;
  uniform float farClip;
  uniform float aspect;
  uniform float outputHeight;

  float viewDepth(vec2 uv) {
    return -perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(tDepth, uv)), nearClip, farClip);
  }

  void main() {
    vec4 center = texture2D(tColor, vUv);
    float depth = viewDepth(vUv);
    float separation = abs(depth - focus);
    // A soft dead band defines the readable zone in world units independently
    // of aperture. The quadratic shoulder avoids a visible sharp/blur boundary.
    float outside = max(0.0, separation - focusWidth);
    outside *= outside / (outside + 0.08);
    float radius = min(maxblur, aperture * outside / max(depth, 0.1));
    if (radius * outputHeight < 0.35) {
      gl_FragColor = center;
      return;
    }
    vec2 diskScale = vec2(1.0 / aspect, 1.0) * radius;
    float filterLod = max(0.0, log2(max(1.0, radius * outputHeight * 0.18)));
    vec4 sum = center;
    float weightSum = 1.0;
    for (int i = 0; i < 96; i++) {
      float r = sqrt((float(i) + 0.5) / 96.0);
      float angle = float(i) * 2.39996323;
      vec2 offset = vec2(cos(angle), sin(angle)) * r * diskScale;
      vec2 sampleUv = clamp(vUv + offset, vec2(0.0), vec2(1.0));
      float sampleDepth = viewDepth(sampleUv);
      // Keep a distant/background pixel from pulling a sharp foreground edge
      // through it. Continuous weights also preserve rounded silhouettes.
      float nearer = max(0.0, depth - sampleDepth);
      float sampleOutside = max(0.0, abs(sampleDepth - focus) - focusWidth);
      sampleOutside *= sampleOutside / (sampleOutside + 0.08);
      float sampleRadius = min(maxblur, aperture * sampleOutside / max(sampleDepth, 0.1));
      float coverage = smoothstep(radius * r * 0.8, radius * r * 1.2, sampleRadius);
      float edgeWeight = mix(1.0, coverage, smoothstep(0.25, 0.75, nearer));
      float weight = exp(-2.0 * r * r) * edgeWeight;
      sum += texture2D(tColor, sampleUv, filterLod) * weight;
      weightSum += weight;
    }
    // Average linear premultiplied color AND alpha. OutputPass unpremultiplies
    // before sRGB transfer, avoiding dark/glowing borders on transparent PNGs.
    gl_FragColor = sum / weightSum;
  }
`;
