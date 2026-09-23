import ActivityFragment from "@/graphql/fragments/activity";
import gql from "graphql-tag";

const ReorderFavoriteActivities = gql`
  mutation ReorderFavoriteActivities($activityIds: [ID!]!) {
    reorderFavoriteActivities(activityIds: $activityIds) {
      ...Activity
    }
  }
  ${ActivityFragment}
`;

export default ReorderFavoriteActivities;
