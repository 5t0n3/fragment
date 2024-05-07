{stdenv, zig}: 

stdenv.mkDerivation {
  pname = "frontend";
  version = "0.0.0";

  nativeBuildInputs = [zig.hook];

  src = builtins.path {
    path = ./.;
    name = "frontend-src";
    filter = path: _: !builtins.elem (baseNameOf path) ["zig-cache" "zig-out"] ;
  };
}
