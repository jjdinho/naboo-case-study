import ActivityFragment from "@/graphql/fragments/activity";
import gql from "graphql-tag";

const GetFavoriteActivities = gql`
  query GetFavoriteActivities {
    getFavoriteActivities {
      ...Activity
    }
  }
  ${ActivityFragment}
`;

export default GetFavoriteActivities;
