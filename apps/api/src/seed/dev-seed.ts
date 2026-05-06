import datapointsSeed from "../../../../docs/iser.datapoints.json" with { type: "json" };
import datapointsSeed2 from "../../../../docs/iser.datapoints2.json" with { type: "json" };
import datapointsSeed3 from "../../../../docs/iser.datapoints3.json" with { type: "json" };
import datapointsSeed4 from "../../../../docs/iser.datapoints4.json" with { type: "json" };

import { ClientModel } from "../models/client.js";
import { ClusterModel } from "../models/cluster.js";
import { DatapointModel } from "../models/datapoint.js";
import { SiteModel } from "../models/site.js";

export async function seedDevelopmentData() {
  const existingClients = await ClientModel.countDocuments();
  if (existingClients > 0) {
    return;
  }

  const client = await ClientModel.create({
    name: "Northstar Indoor",
    slug: "northstar-indoor",
  });

  const [siteA, siteB, siteC, siteD] = await SiteModel.create([
    {
      clientId: client._id,
      name: "Bristol Facility",
      code: "BRI-01",
      metadataExtractionTokensTotal: 0,
    },
    {
      clientId: client._id,
      name: "Leeds Facility",
      code: "LDS-02",
      metadataExtractionTokensTotal: 0,
    },
    {
      clientId: client._id,
      name: "Manchester Facility",
      code: "MAN-03",
      metadataExtractionTokensTotal: 0,
    },
    {
      clientId: client._id,
      name: "Sheffield Facility",
      code: "SHF-04",
      metadataExtractionTokensTotal: 0,
    }
  ]);

  await DatapointModel.create(
    datapointsSeed.map((datapoint) => ({
      siteId: siteB._id,
      rawName: datapoint.rawName,
      identifier: datapoint.identifier,
      manufacturer: datapoint.manufacturer,
    })),
  );

  await DatapointModel.create(
    datapointsSeed2.map((datapoint) => ({
      siteId: siteA._id,
      rawName: datapoint.rawName,
      identifier: datapoint.identifier,
      manufacturer: datapoint.manufacturer,
    })),
  );

  await DatapointModel.create(
    datapointsSeed3.map((datapoint) => ({
      siteId: siteC._id,
      rawName: datapoint.rawName,
      identifier: datapoint.identifier,
      manufacturer: datapoint.manufacturer,
    })),
  );

  await DatapointModel.create(
    datapointsSeed4.map((datapoint) => ({
      siteId: siteD._id,
      rawName: datapoint.rawName,
      identifier: datapoint.identifier,
      manufacturer: datapoint.manufacturer,
    })),
  );

  await ClusterModel.deleteMany({});
}
