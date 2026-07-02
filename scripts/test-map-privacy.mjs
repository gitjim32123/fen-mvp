import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

function loadTsModule(path, overrides = {}) {
  const sourcePath = resolve(path);
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require: (name) => {
      if (overrides[name]) return overrides[name];
      throw new Error(`Unexpected require: ${name}`);
    },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return sandbox;
}

const postcodeDistrictsSandbox = loadTsModule("lib/postcodeDistricts.ts");
const geocodeCalls = [];
const mapPrivacySandbox = loadTsModule("lib/mapPrivacy.ts", {
  "./postcodeDistricts": postcodeDistrictsSandbox.module.exports,
  "./geocoding": {
    geocodePostcodeArea: async (postcode) => {
      geocodeCalls.push(postcode);
      return postcode === "DN11" ? { latitude: 53.43, longitude: -1.08 } : null;
    },
  },
});
const mapPrivacy = mapPrivacySandbox.module.exports;

const exactJob = {
  id: "job-private-location",
  postcode: "DN11 8AA",
  postcode_district: "DN11",
  lat: 53.471234,
  lng: -1.104321,
};

assert.equal(mapPrivacy.canUseExactJobCoordinates("public_browse"), false);
assert.equal(mapPrivacy.canUseExactJobCoordinates("poster_private"), true);
assert.equal(mapPrivacy.canUseExactJobCoordinates("accepted_worker_private"), true);

const sanitized = mapPrivacy.sanitizeJobForPublicBrowse(exactJob);
assert.equal(sanitized.lat, null);
assert.equal(sanitized.lng, null);
assert.equal(exactJob.lat, 53.471234);
assert.equal(exactJob.lng, -1.104321);

const publicPoint = await mapPrivacy.resolveJobRoutePoint(exactJob, "public_browse");
assert.equal(publicPoint.precision, "approximate");
assert.equal(publicPoint.point.latitude, 53.43);
assert.equal(publicPoint.point.longitude, -1.08);
assert.deepEqual(geocodeCalls, ["DN11"]);

const posterPoint = await mapPrivacy.resolveJobRoutePoint(exactJob, "poster_private");
assert.equal(posterPoint.precision, "exact");
assert.equal(posterPoint.point.latitude, 53.471234);
assert.equal(posterPoint.point.longitude, -1.104321);

geocodeCalls.length = 0;
const browsePoints = await mapPrivacy.preparePublicBrowseJobPoints([exactJob]);
assert.equal(browsePoints.length, 1);
assert.equal(browsePoints[0].area, "DN11");
assert.equal(browsePoints[0].point.latitude, 53.43);
assert.equal(browsePoints[0].point.longitude, -1.08);
assert.notEqual(browsePoints[0].point.latitude, exactJob.lat);
assert.notEqual(browsePoints[0].point.longitude, exactJob.lng);
assert.deepEqual(geocodeCalls, ["DN11"]);

console.log("map privacy tests passed");
