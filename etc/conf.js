/**
 * User: philliprosen
 * Date: 11/2/12
 * Time: 3:31 PM
 */
module.exports = {

    production:{
        redis:{
            port:6379,
            host:'localhost',
        },

        mongo:{
          'user':'',
          'password':'',
          'db':'venues',
          'port':27017,
          'host':'localhost',
          "model_collection_mapping":{
            "VenueCount":"venue_city_counts",
            "RestaurantMerged":"restaurants2"
          }
        },
        jobRoot:__dirname + '../lib/jobs/',
        aws:{
            s3:{
                bucket:'ordrin_reports',
                key:'uIY3ajIjqCrha0WNd8uJ+EY7YOVVIx++COwvkRmG',
                secret:'AKIAI6FVVY7BU6GDGE3A'
            }
        },
        s3DataBucket:'skyfetch-data',

        proxyCloudList:[],
    }


}