class GEOHASH {
  static BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

  encode(latitude, longitude, precision) {
    let minLatitude = -90;
    let maxLatitude = 90;

    let minLongitude = -180;
    let maxLongitude = 180;

    let evenBit = true;
    let bit = 0;
    let ch = 0;

    let geoHash = "";

    while (geoHash.length < precision) {
      if (evenBit) {
        let mid = (minLongitude + maxLongitude) / 2.0;
        if (longitude >= mid) {
          ch = (ch << 1) | 1;
          minLongitude = mid;
        } else {
          ch = ch << 1;
          maxLongitude = mid;
        }
      } else {
        let mid = (minLatitude + maxLatitude) / 2.0;
        if (latitude >= mid) {
          ch = (ch << 1) | 1;
          minLatitude = mid;
        } else {
          ch = ch << 1;
          maxLatitude = mid;
        }
      }

      evenBit = !evenBit;
      bit++;

      if (bit == 5) {
        geoHash += GEOHASH.BASE32.charAt(ch);
        bit = 0;
        ch = 0;
      }
    }
    return geoHash;
  }

  decode(geoHash) {
    let minLatitude = -90;
    let maxLatitude = 90;

    let minLongitude = -180;
    let maxLongitude = 180;

    let evenBit = true;

    for (const c of geoHash) {
      const value = GEOHASH.BASE32.indexOf(c);

      if (value == -1) {
        throw new Error("Invalid geo hash");
      }

      for (let mask = 16; mask != 0; mask >>= 1) {
        const bit = (value & mask) != 0 ? 1 : 0;

        if (evenBit) {
          let mid = (maxLongitude + minLongitude) / 2;

          if (bit) {
            minLongitude = mid;
          } else {
            maxLongitude = mid;
          }
        } else {
          let mid = (maxLatitude + minLatitude) / 2;

          if (bit) {
            minLatitude = mid;
          } else {
            maxLatitude = mid;
          }
        }
        evenBit = !evenBit; // if true -> false , if false -> true
      }
    }
    return {
      latitude: (maxLatitude + minLatitude) / 2,
      longitude: (minLongitude + maxLongitude) / 2,
      latitudeRange: [minLatitude, maxLatitude],
      longitudeRange: [minLongitude, maxLongitude],
    };
  }

  neighbors(geoHash) {
    const point = this.decode(geoHash);
    let latitudeStep = point.latitudeRange[1] - point.latitudeRange[0];
    let longitudeSteps = point.longitudeRange[1] - point.longitudeRange[0];

    return {
      north: this.encode(
        point.latitude + latitudeStep,
        point.longitude,
        geoHash.length,
      ),
      south: this.encode(
        point.latitude - latitudeStep,
        point.longitude,
        geoHash.length,
      ),
      east: this.encode(
        point.latitude,
        point.longitude + longitudeSteps,
        geoHash.length,
      ),
      west: this.encode(
        point.latitude,
        point.longitude - longitudeSteps,
        geoHash.length,
      ),

      northEast: this.encode(
        point.latitude + latitudeStep,
        point.longitude + longitudeSteps,
        geoHash.length,
      ),
      northWest: this.encode(
        point.latitude + latitudeStep,
        point.longitude - longitudeSteps,
        geoHash.length,
      ),
      southEast: this.encode(
        point.latitude - latitudeStep,
        point.longitude + longitudeSteps,
        geoHash.length,
      ),

      southWest: this.encode(
        point.latitude - latitudeStep,
        point.longitude - longitudeSteps,
        geoHash.length,
      ),
    };
  }

  toRadians(degree) {
    return degree * (Math.PI / 180);
  }

  haversineDistance(latitude1, longitude1, latitude2, longitude2) {
    // converting in to radian
    let updatedLatitude1 = this.toRadians(latitude1);
    let updatedLatitude2 = this.toRadians(latitude2);
    let updatedLongitude1 = this.toRadians(longitude1);
    let updatedLongitude2 = this.toRadians(longitude2);

    let differenceLatitude = updatedLatitude2 - updatedLatitude1;
    let differenceLongitude = updatedLongitude2 - updatedLongitude1;

    let area =
      Math.pow(Math.sin(differenceLatitude / 2), 2) +
      Math.cos(updatedLatitude1) *
        Math.cos(updatedLatitude2) *
        Math.pow(Math.sin(differenceLongitude / 2), 2);

    let radius = 6371; // in km

    let cal = 2 * Math.atan2(Math.sqrt(area), Math.sqrt(1 - area));

    let distance = radius * cal;

    return distance;
  }
}

export default GEOHASH;
// const geo = new GEOHASH();

// const hash = geo.encode(77.209, 28.6139, 7);

//     77.2090,
//     28.7041,
//     77.1025));
