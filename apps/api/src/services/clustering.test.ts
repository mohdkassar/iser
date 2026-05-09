import test from "node:test";
import assert from "node:assert/strict";

import { buildRoomClusters } from "./room-clustering.js";

test("buildRoomClusters groups datapoints with similar room aliases", () => {
  const clusters = buildRoomClusters([
    {
      id: "1",
      siteId: "site-1",
      rawName: "GRM-A AHU1 Z1 TEMP",
      identifier: "dp1",
      manufacturer: "Acme",
      metadata: {
        roomCandidate: "grow_room_a",
        roomAliases: ["GRM-A", "GrowA"],
        humanReadableName: "Grow Room A Air Handling Unit 1 Temperature",
        equipmentGroup: "ahu",
        deviceInstance: "ahu1",
        deviceType: "temperature",
        subzone: "z1",
        confidence: 0.9,
      },
    },
    {
      id: "2",
      siteId: "site-1",
      rawName: "GrowRoomA AHU1 Z1 HUM",
      identifier: "dp2",
      manufacturer: "Acme",
      metadata: {
        roomCandidate: "grow room a",
        roomAliases: ["GrowA", "RoomA"],
        humanReadableName: "Grow Room A Humidity Sensor",
        equipmentGroup: "ahu",
        deviceInstance: "ahu1",
        deviceType: "humidity",
        subzone: "z1",
        confidence: 0.87,
      },
    },
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.datapoints.length, 2);
});

test("buildRoomClusters consolidates clusters that only become mergeable after the first pass", () => {
  const clusters = buildRoomClusters([
    {
      id: "1",
      siteId: "site-1",
      rawName: "GRM-A SAT",
      identifier: "dp1",
      manufacturer: "Acme",
      metadata: {
        roomCandidate: "grow_room_a",
        roomAliases: ["grm a"],
        humanReadableName: "Grow Room A Supply Air Temperature",
        equipmentGroup: "ahu",
        deviceInstance: "ahu1",
        deviceType: "temperature",
        subzone: "z1",
        confidence: 0.9,
      },
    },
    {
      id: "2",
      siteId: "site-1",
      rawName: "Grow A RAT",
      identifier: "dp2",
      manufacturer: "Acme",
      metadata: {
        roomCandidate: "grow room a",
        humanReadableName: "Grow Room A AHU",
        roomAliases: ["growa", "room a"],
        equipmentGroup: "ahu",
        deviceInstance: "ahu1",
        deviceType: "temperature",
        subzone: "z1",
        confidence: 0.9,
      },
    },
    {
      id: "3",
      siteId: "site-1",
      rawName: "Room A CO2",
      identifier: "dp3",
      manufacturer: "Acme",
      metadata: {
        roomCandidate: "room a",
        humanReadableName: "Room A CO2 Sensor",
        roomAliases: ["grm a", "growa", "room a"],
        equipmentGroup: "sensor",
        deviceInstance: "co2-1",
        deviceType: "co2",
        subzone: "z1",
        confidence: 0.85,
      },
    },
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.datapoints.length, 3);
  assert.deepEqual(
    Array.from(clusters[0]?.aliases ?? []).sort(),
    ["grow room a", "growa", "grm a", "room a"].sort(),
  );
});
