// Decorative yard adapted from WareTrack; no physical facility dimensions are asserted.
import { Block, Pallet, Tree } from "./Primitives";
export function SiteGround() {
  return (
    <group>
      <Block position={[0, -0.4, 1]} size={[43, 0.8, 34]} color="#d9e2ec" />
      <Block position={[0, 0.015, -1.5]} size={[42.6, 0.04, 28]} color="#edf1f6" />
      <Block position={[0, 0.04, 13.9]} size={[42.7, 0.05, 5.6]} color="#cdd7e4" />
      <Block position={[0, 0.08, 10.85]} size={[42.7, 0.13, 0.4]} color="#f9fbfd" />
      <Block position={[0, 0.08, 16.95]} size={[42.7, 0.13, 0.4]} color="#f9fbfd" />
      {Array.from({ length: 15 }, (_, i) => (
        <Block key={i} position={[-20 + i * 2.85, 0.076, 14]} size={[1.25, 0.015, 0.09]} color="#f9fbff" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Block key={i} position={[18, 0.08, 11.5 + i * 0.57]} size={[2.3, 0.015, 0.25]} color="#f6f9ff" />
      ))}
      {[-8.25, -4.95, -1.65, 1.65, 4.95, 8.25].map((x) => (
        <group key={x}>
          <Block position={[x - 1.42, 0.045, 5.65]} size={[0.055, 0.018, 6.5]} color="#d7bc79" />
          <Block position={[x, 0.045, 8.9]} size={[2.9, 0.018, 0.06]} color="#d7bc79" />
        </group>
      ))}
      {[-18.8, 19.6].map((x) => (
        <group key={x}>
          <Block position={[x, 0.05, -2]} size={[1.8, 0.1, 22]} color="#dde8de" />
          {[-11, -6, -0.8, 4.5, 9].map((z) => (
            <Tree key={z} position={[x, 0.1, z]} scale={0.9} />
          ))}
        </group>
      ))}
      {[-16, -10, -4, 2, 8, 14].map((x) => (
        <Tree key={x} position={[x, 0.05, -13.6]} scale={0.85} />
      ))}
      {[-16, -10, -4, 2, 8, 14].map((x) => (
        <Tree key={x} position={[x, 0.05, 18]} scale={0.7} />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <group key={i} position={[-20 + i * 2.4, 0, -15]}>
          <Block position={[0, 0.85, 0]} size={[0.06, 1.7, 0.06]} color="#a5b3c1" />
          <Block position={[1.2, 1.5, 0]} size={[2.4, 0.035, 0.035]} color="#b8c5d1" />
          <Block position={[1.2, 0.7, 0]} size={[2.4, 0.025, 0.025]} color="#b8c5d1" />
        </group>
      ))}
      {[-15, 16].map((x) => (
        <group key={x} position={[x, 0, 10]}>
          <Block position={[0, 2, 0]} size={[0.09, 4, 0.09]} color="#8394a6" />
          <Block position={[0.4, 4, 0]} size={[0.8, 0.08, 0.12]} color="#8394a6" />
        </group>
      ))}
      <Block position={[-14.6, 1, 3.8]} size={[4.5, 2, 2]} color="#609f98" />
      {Array.from({ length: 11 }, (_, i) => (
        <Block key={i} position={[-16.5 + i * 0.4, 1, 4.82]} size={[0.035, 1.85, 0.04]} color="#8bbdb7" />
      ))}
      <Block position={[-14.6, 2.04, 3.8]} size={[4.6, 0.08, 2.1]} color="#8fc0b9" />
      {[
        [-13, 0, 7],
        [-11.6, 0, 7],
        [10.5, 0, 8],
        [11.6, 0, 8],
        [11, 0, -8],
      ].map((p, i) => (
        <Pallet key={i} position={p as [number, number, number]} />
      ))}
    </group>
  );
}
