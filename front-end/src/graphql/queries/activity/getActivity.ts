import ActivityFragment from "@/graphql/fragments/activity";
import OwnerFragment from "@/graphql/fragments/owner";
import gql from "graphql-tag";

const GetActivity = gql`
  query GetActivity($id: String!) {
    getActivity(id: $id) {
      ...Activity
      owner {
        ...Owner
      }
    }
  }
  ${ActivityFragment}
  ${OwnerFragment}
`;

export default GetActivity;
