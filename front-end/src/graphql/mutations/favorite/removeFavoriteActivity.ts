import ActivityFragment from "@/graphql/fragments/activity";
import gql from "graphql-tag";

const RemoveFavoriteActivity = gql`
  mutation RemoveFavoriteActivity($activityId: ID!) {
    removeFavoriteActivity(activityId: $activityId) {
      ...Activity
    }
  }
  ${ActivityFragment}
`;

export default RemoveFavoriteActivity;
