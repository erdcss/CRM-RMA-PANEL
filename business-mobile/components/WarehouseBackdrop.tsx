import { StyleSheet, Text, View } from "react-native";
import { C } from "../ui/theme";

export function WarehouseBackdrop({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={s.bg} />
      <View style={s.lightA} />
      <View style={s.lightB} />

      <View style={[s.box, s.boxBackLeft]}>
        <Text style={s.boxLogoSmall}>ÇALIŞKAN</Text>
        <Text style={s.boxB2BSmall}>B2B</Text>
      </View>
      <View style={[s.box, s.boxBackRight]}>
        <Text style={s.boxLogoSmall}>ÇALIŞKAN</Text>
        <Text style={s.boxB2BSmall}>B2B</Text>
      </View>
      <View style={[s.box, s.boxMain]}>
        <View style={s.tape} />
        <Text style={s.boxLogo}>ÇALIŞKAN</Text>
        <View style={s.logoLine} />
        <Text style={s.boxB2B}>B2B</Text>
      </View>

      <View style={[s.floor, dimmed && s.floorDim]} />
      {dimmed ? <View style={s.blurMask} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#04070A",
  },
  lightA: {
    position: "absolute",
    width: 180,
    height: 420,
    right: -36,
    top: 20,
    borderRadius: 100,
    backgroundColor: "rgba(202,164,113,0.08)",
    transform: [{ rotate: "11deg" }],
  },
  lightB: {
    position: "absolute",
    width: 110,
    height: 320,
    left: -28,
    top: 110,
    borderRadius: 80,
    backgroundColor: "rgba(92,132,186,0.06)",
    transform: [{ rotate: "-8deg" }],
  },
  box: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#29313A",
    backgroundColor: "#11151A",
    shadowColor: "#000",
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  boxBackLeft: {
    width: 132,
    height: 112,
    left: -34,
    top: 260,
    opacity: 0.52,
    transform: [{ rotateY: "12deg" }, { rotateZ: "-2deg" }],
  },
  boxBackRight: {
    width: 148,
    height: 126,
    right: -40,
    top: 208,
    opacity: 0.48,
    transform: [{ rotateY: "-16deg" }, { rotateZ: "3deg" }],
  },
  boxMain: {
    width: 245,
    height: 190,
    right: 18,
    top: 128,
    padding: 24,
    borderRadius: 6,
    transform: [{ perspective: 700 }, { rotateY: "-10deg" }, { rotateZ: "1deg" }],
  },
  tape: {
    position: "absolute",
    top: 0,
    left: "47%",
    width: 28,
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.33)",
  },
  boxLogo: {
    marginTop: 48,
    color: "#EDEFF2",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  logoLine: {
    height: 2,
    width: 132,
    marginTop: 5,
    backgroundColor: "#EDEFF2",
  },
  boxB2B: {
    color: "#EDEFF2",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 5,
    marginLeft: 108,
  },
  boxLogoSmall: {
    color: "#9AA1AA",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 38,
    marginLeft: 16,
  },
  boxB2BSmall: {
    color: "#7E8792",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 70,
  },
  floor: {
    position: "absolute",
    left: -50,
    right: -50,
    height: 220,
    top: 310,
    backgroundColor: "rgba(0,0,0,0.44)",
    transform: [{ rotateX: "62deg" }],
  },
  floorDim: { opacity: 0.72 },
  blurMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,5,9,0.56)",
  },
});
