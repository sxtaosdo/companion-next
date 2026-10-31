// Actual isolated backend output, not Creator/HTTP observation.
export default {
  "meaning": "Actual candidate IconAdapter implementation with isolated process/filesystem fixtures; no real HTTP/Creator/import",
  "projectId": "16ad921aa0fb06d6",
  "input": {
    "jobId": "STUDIO-RUN-handoff-deadbeef",
    "revision": 6,
    "candidateId": "CANDIDATE-coin-1",
    "artifact": {
      "kind": "variant",
      "width": 96,
      "height": 96
    },
    "purpose": "Read-only handoff",
    "target": {
      "destinationUrl": "db://assets/icons/coin-96x96-336c90ddceab.png",
      "documentUrl": null,
      "nodeKey": null
    }
  },
  "job": {
    "projectId": "16ad921aa0fb06d6",
    "jobId": "STUDIO-RUN-handoff-deadbeef",
    "revision": 6,
    "state": "selected",
    "sourceRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "requestHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "profile": "fixed",
    "budget": {
      "maxAssets": 2,
      "candidatesPerAsset": 1,
      "submissionAttempts": 1
    },
    "createdAt": "2026-10-22T00:00:00Z",
    "assets": [
      {
        "assetId": "coin",
        "relativePath": "assets/icons/coin.png"
      }
    ],
    "candidates": [
      {
        "candidateId": "CANDIDATE-coin-1",
        "assetId": "coin",
        "fileSha256": "68871b660bdbc0c7b3a356e7360102afd9757e8963512a37b32b2e24d2ebad68",
        "width": 1024,
        "height": 1024,
        "hasAlpha": true
      }
    ],
    "selectedIds": [
      "CANDIDATE-coin-1"
    ],
    "workerResident": false,
    "productionVerified": false,
    "import": null,
    "variantImport": {
      "operationId": "icon-import-11111111111111111111111111111111",
      "state": "imported_pending_verification",
      "effectApplied": true,
      "leaseState": "RELEASED",
      "errorCode": null,
      "artifact": {
        "kind": "variant",
        "candidateId": "CANDIDATE-coin-1",
        "width": 96,
        "height": 96,
        "fileSha256": "336c90ddceab3cd1bbb23edc3bf2fe1cec3692ab8f06e8951f2ba1a53fccdaf7",
        "receiptSha256": "dcba70a0e8170424a9c7f9e6f430c8b2fb014f4ce722ab95991162b4b1d4e7d8",
        "destinationUrl": "db://assets/icons/coin-96x96-336c90ddceab.png"
      },
      "tools": [],
      "active": false
    },
    "resourceSnapshot": {
      "state": "sealed",
      "version": 1,
      "hash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "presetId": "default",
      "config": {
        "schemaVersion": "project-resource-config-v2",
        "projectId": "16ad921aa0fb06d6",
        "version": 1,
        "designResolution": {
          "width": 750,
          "height": 1334
        },
        "orientation": "portrait",
        "iconSize": {
          "width": 96,
          "height": 96
        },
        "style": {
          "description": "readable",
          "references": []
        },
        "background": {
          "format": "png",
          "transparent": true,
          "color": "#ffffff"
        },
        "composition": {
          "centered": true,
          "paddingPercent": 10
        },
        "destination": {
          "directory": "assets/icons",
          "exportDirectory": "art/final/icons",
          "naming": "kebab-case"
        }
      },
      "referenceSnapshots": []
    }
  },
  "response": {
    "schemaVersion": "companion-icons-v1",
    "handoff": {
      "schemaVersion": "companion-icon-handoff-v1",
      "projectId": "16ad921aa0fb06d6",
      "sourceRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "purpose": "Read-only handoff",
      "job": {
        "jobId": "STUDIO-RUN-handoff-deadbeef",
        "revision": 6,
        "candidateId": "CANDIDATE-coin-1",
        "requestHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "configHash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "state": "selected",
        "configVersion": 1
      },
      "asset": {
        "candidateId": "CANDIDATE-coin-1",
        "assetId": "coin",
        "motherSha256": "68871b660bdbc0c7b3a356e7360102afd9757e8963512a37b32b2e24d2ebad68",
        "kind": "variant",
        "relativePath": "art/final/icons/coin-96x96-68871b660bdb.png",
        "sha256": "336c90ddceab3cd1bbb23edc3bf2fe1cec3692ab8f06e8951f2ba1a53fccdaf7",
        "width": 96,
        "height": 96,
        "sha256Verified": true,
        "receiptSha256": "dcba70a0e8170424a9c7f9e6f430c8b2fb014f4ce722ab95991162b4b1d4e7d8",
        "savedCreatorDestination": "assets/icons/coin-96x96-336c90ddceab.png"
      },
      "resource": {
        "state": "sealed",
        "designResolution": {
          "width": 750,
          "height": 1334
        },
        "iconSize": {
          "width": 96,
          "height": 96
        },
        "referencesAsModelInput": false
      },
      "referenceProvenance": [],
      "target": {
        "destinationUrl": "db://assets/icons/coin-96x96-336c90ddceab.png",
        "documentUrl": null,
        "nodeKey": null,
        "component": "cc.Sprite",
        "property": "spriteFrame"
      },
      "evidence": {
        "imported": {
          "state": "not_proven",
          "receiptSha256": null,
          "assetUuid": null,
          "spriteFrameUuid": null
        },
        "bound": {
          "state": "not_proven",
          "receiptSha256": null,
          "assetUuid": null,
          "spriteFrameUuid": null
        },
        "runtimeVerified": {
          "state": "not_run",
          "receiptSha256": null,
          "designResolutionVerified": false
        },
        "observedImport": {
          "operationId": "icon-import-11111111111111111111111111111111",
          "state": "imported_pending_verification",
          "effectApplied": true,
          "leaseState": "RELEASED"
        },
        "manualAttestation": null
      },
      "delivery": {
        "mode": "export_or_copy",
        "state": "prepared",
        "dispatchId": null
      },
      "receiver": {
        "freshProjectAndRevisionRequired": true,
        "freshCoordinationRequired": true,
        "writeAuthorizationIncluded": false,
        "unknownReplayAllowed": false,
        "importVerificationTools": [
          "asset_get_info",
          "asset_resolve_reference"
        ],
        "bindingTools": [
          "scene_apply_patch",
          "prefab_apply_patch"
        ],
        "runtimeIdentityProvider": null
      }
    }
  },
  "processCalls": [
    "status",
    "status",
    "candidate",
    "import-query",
    "status"
  ]
}
